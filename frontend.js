import { ethers } from 'ethers';
import { Token } from '@pancakeswap/swap-sdk-core';
import { Pool, Position } from '@pancakeswap/v3-sdk';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    const walletStatusEl = document.getElementById('walletStatus');
    const networkStatusEl = document.getElementById('networkStatus');
    const accountStatusEl = document.getElementById('accountStatus');
    const fetchDataBtn = document.getElementById('fetchDataBtn');
    const liquidityForm = document.getElementById('liquidityForm');
    const txStatusEl = document.getElementById('txStatus');
    const txLinkEl = document.getElementById('txLink');
    const txLinkContainerEl = document.getElementById('txLinkContainer');
    const liveDataEl = document.getElementById('liveData');

    // --- Constants ---
    const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364';
    const BSC_CHAIN_ID = 56;

    // --- ABIs ---
    const ERC20_ABI = [
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)',
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
        'function balanceOf(address account) view returns (uint256)',
    ];
    const POOL_ABI = [
        'function token0() view returns (address)',
        'function token1() view returns (address)',
        'function fee() view returns (uint24)',
        'function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)',
        'function liquidity() view returns (uint128)',
    ];

    // --- State ---
    let provider, signer, currentAccount;
    let calculatedData = {}; // To store fetched & calculated data for the transaction

    // --- Wallet & UI Functions ---
    async function connectWallet() {
        if (typeof window.ethereum === 'undefined') {
            return alert('MetaMask is not installed!');
        }
        try {
            provider = new ethers.providers.Web3Provider(window.ethereum);
            const accounts = await provider.send('eth_requestAccounts', []);
            signer = provider.getSigner();
            currentAccount = accounts[0];
            updateWalletUI();
            window.ethereum.on('accountsChanged', (accounts) => {
                currentAccount = accounts[0];
                updateWalletUI();
            });
            window.ethereum.on('chainChanged', () => window.location.reload());
        } catch (err) {
            console.error('Failed to connect wallet', err);
            alert('Failed to connect wallet.');
        }
    }

    async function updateWalletUI() {
        if (!signer) {
            walletStatusEl.textContent = 'Status: Not Connected';
            return;
        }
        const network = await provider.getNetwork();
        walletStatusEl.textContent = 'Status: Connected';
        accountStatusEl.textContent = `Account: ${currentAccount}`;
        if (network.chainId !== BSC_CHAIN_ID) {
            networkStatusEl.textContent = `Wrong Network! Please switch to BSC Mainnet.`;
            networkStatusEl.style.color = 'red';
        } else {
            networkStatusEl.textContent = `Network: ${network.name}`;
            networkStatusEl.style.color = 'green';
        }
    }

    async function fetchAndSetCurrentTick() {
        const poolAddress = document.getElementById('poolAddress').value;
        if (!provider || !ethers.utils.isAddress(poolAddress)) {
            return;
        }

        try {
            const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);
            const slot0 = await poolContract.slot0();
            const currentTick = slot0[1]; // tick is at index 1

            if (currentTick !== undefined) {
                document.getElementById('tickLower').value = currentTick;
                document.getElementById('tickUpper').value = currentTick;
            }
        } catch (error) {
            console.error('Could not fetch current tick:', error);
            // Fail silently for better UX
        }
    }

    // --- Core Logic ---
    async function fetchAndCalculate() {
        if (!signer) return alert('Please connect your wallet first.');

        // --- 1. Get all values from DOM --- 
        const poolAddress = document.getElementById('poolAddress').value;
        const amount0DesiredStr = document.getElementById('amount0Desired').value;
        const tickLowerStr = document.getElementById('tickLower').value;
        const tickUpperStr = document.getElementById('tickUpper').value;

        // --- 2. Validate inputs ---
        if (!ethers.utils.isAddress(poolAddress) || !amount0DesiredStr || !tickLowerStr || !tickUpperStr) {
            return alert('Please fill in all required fields correctly.');
        }

        const tickLower = parseInt(tickLowerStr, 10);
        const tickUpper = parseInt(tickUpperStr, 10);

        if (isNaN(tickLower) || isNaN(tickUpper)) {
            return alert('Tick values must be valid numbers.');
        }

        if (tickLower >= tickUpper) {
            liveDataEl.innerHTML = `<p style="color:red;">Error: Tick Lower must be less than Tick Upper.</p>`;
            return;
        }

        liveDataEl.innerHTML = 'Fetching data...';

        try {
            // --- 3. Fetch pool data from blockchain ---
            const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);
            const [token0Addr, token1Addr, fee, slot0, liquidity] = await Promise.all([
                poolContract.token0(),
                poolContract.token1(),
                poolContract.fee(),
                poolContract.slot0(),
                poolContract.liquidity(),
            ]);

            const token0Contract = new ethers.Contract(token0Addr, ERC20_ABI, provider);
            const token1Contract = new ethers.Contract(token1Addr, ERC20_ABI, provider);

            const [token0Decimals, token1Decimals, token0Symbol, token1Symbol, token0Balance, token1Balance] = await Promise.all([
                token0Contract.decimals(),
                token1Contract.decimals(),
                token0Contract.symbol(),
                token1Contract.symbol(),
                token0Contract.balanceOf(currentAccount),
                token1Contract.balanceOf(currentAccount),
            ]);

            // --- 4. Use PancakeSwap SDK to calculate missing amount ---
            const TOKEN0 = new Token(BSC_CHAIN_ID, token0Addr, token0Decimals, token0Symbol);
            const TOKEN1 = new Token(BSC_CHAIN_ID, token1Addr, token1Decimals, token1Symbol);

            const pool = new Pool(
                TOKEN0,
                TOKEN1,
                fee,
                slot0[0].toString(), // sqrtPriceX96
                liquidity.toString(),
                slot0[1] // tick
            );

            const amount0InWei = ethers.utils.parseUnits(amount0DesiredStr, token0Decimals);

            const position = Position.fromAmount0({
                pool: pool,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0: amount0InWei.toBigInt(),
                useFullPrecision: true,
            });

            const amount1DesiredBI = position.amount1.quotient;

            // --- 5. Store all data for transaction submission ---
            calculatedData = {
                token0: token0Addr,
                token1: token1Addr,
                fee: fee,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amount0InWei,
                amount1Desired: ethers.BigNumber.from(amount1DesiredBI.toString()),
                recipient: currentAccount,
                deadline: Math.floor(Date.now() / 1000) + 60 * 20,
                token0Symbol,
                token1Symbol,
                token0Decimals,
                token1Decimals,
                token0Balance,
                token1Balance,
            };

            // --- 6. Display results to user ---
            const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
            const currentTick = pool.tickCurrent;
            let amount1Display;

            if (amount1DesiredBI === MAX_UINT256) {
                amount1Display = `Effectively infinite. <br><small style="color:#ffc107;">(The required amount of ${token1Symbol} is impractically large.)</small>`;
            } else if (amount1DesiredBI === 0n) {
                amount1Display = `0.0 <br><small style="color:#ffc107;">(Your range is entirely below the current price.)</small>`;
            } else {
                amount1Display = ethers.utils.formatUnits(amount1DesiredBI, token1Decimals);
            }

            liveDataEl.innerHTML = `
                <p><strong>Token 0:</strong> ${token0Symbol} (${token0Addr})</p>
                <p><strong>Token 1:</strong> ${token1Symbol} (${token1Addr})</p>
                <p><strong>Fee Tier:</strong> ${fee}</p>
                <hr>
                <p><strong>Your ${token0Symbol} Balance:</strong> ${ethers.utils.formatUnits(token0Balance, token0Decimals)}</p>
                <p><strong>Your ${token1Symbol} Balance:</strong> ${ethers.utils.formatUnits(token1Balance, token1Decimals)}</p>
                <hr>
                <p><strong>Current Pool Tick:</strong> ${currentTick}</p>
                <p><strong>Input Amount (${token0Symbol}):</strong> ${amount0DesiredStr}</p>
                <p><strong>Calculated Amount (${token1Symbol}):</strong> ${amount1Display}</p>
            `;

        } catch (error) {
            console.error('Calculation failed:', error);
            liveDataEl.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
        }
    }

    async function approveTokenIfNeeded(tokenAddress, amount) {
        // No need to approve if amount is zero (e.g., single-sided deposit)
        if (BigInt(amount.toString()) === 0n) {
            return;
        }

        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(currentAccount, NONFUNGIBLE_POSITION_MANAGER_ADDRESS);
        const tokenSymbol = await tokenContract.symbol();

        // Use .lt() for ethers' BigNumber
        if (allowance.lt(amount)) {
            txStatusEl.textContent = `Requesting approval for ${tokenSymbol}...`;
            const approveTx = await tokenContract.approve(NONFUNGIBLE_POSITION_MANAGER_ADDRESS, ethers.constants.MaxUint256);
            txStatusEl.textContent = `Waiting for ${tokenSymbol} approval confirmation...`;
            await approveTx.wait();
            txStatusEl.textContent = `${tokenSymbol} approved!`;
        } else {
            console.log(`Approval for token ${tokenSymbol} is sufficient.`);
        }
    }

    async function submitTransaction(event) {
        event.preventDefault();
        if (Object.keys(calculatedData).length === 0) {
            return alert('Please fetch and calculate the data first.');
        }

        txStatusEl.textContent = 'Validating transaction...';
        txLinkContainerEl.style.display = 'none';

        try {
            // --- 1. Log everything for debugging ---
            console.log('--- Preparing to Submit Transaction ---');
            console.log('Calculated Data:', calculatedData);
            console.log(`Token 0 Amount Required: ${calculatedData.amount0Desired.toString()}`);
            console.log(`Token 0 Balance:         ${calculatedData.token0Balance.toString()}`);
            console.log(`Token 1 Amount Required: ${calculatedData.amount1Desired.toString()}`);
            console.log(`Token 1 Balance:         ${calculatedData.token1Balance.toString()}`);

            // --- 2. Insufficient Balance Check ---
            if (calculatedData.amount0Desired.gt(calculatedData.token0Balance)) {
                const required = ethers.utils.formatUnits(calculatedData.amount0Desired, calculatedData.token0Decimals);
                const balance = ethers.utils.formatUnits(calculatedData.token0Balance, calculatedData.token0Decimals);
                const message = `Insufficient ${calculatedData.token0Symbol} balance. Required: ${required}, Balance: ${balance}.`;
                console.error(message);
                txStatusEl.textContent = 'Error: Insufficient balance.';
                return alert(message);
            }
            if (calculatedData.amount1Desired.gt(calculatedData.token1Balance)) {
                const required = ethers.utils.formatUnits(calculatedData.amount1Desired, calculatedData.token1Decimals);
                const balance = ethers.utils.formatUnits(calculatedData.token1Balance, calculatedData.token1Decimals);
                const message = `Insufficient ${calculatedData.token1Symbol} balance. Required: ${required}, Balance: ${balance}. This can happen if your price range is too narrow or close to the current price.`;
                console.error(message);
                txStatusEl.textContent = 'Error: Insufficient balance.';
                return alert(message);
            }
            console.log('Balance check passed.');

            // --- 3. Approval Step ---
            txStatusEl.textContent = 'Checking token approvals...';
            await approveTokenIfNeeded(calculatedData.token0, calculatedData.amount0Desired);
            await approveTokenIfNeeded(calculatedData.token1, calculatedData.amount1Desired);
            console.log('Approval checks passed.');

            // --- 4. Mint Step ---
            txStatusEl.textContent = 'Approvals confirmed. Preparing mint transaction...';

            const mintParams = [
                calculatedData.token0,
                calculatedData.token1,
                calculatedData.fee,
                calculatedData.tickLower,
                calculatedData.tickUpper,
                calculatedData.amount0Desired,
                calculatedData.amount1Desired,
                0, // amount0Min (slippage)
                0, // amount1Min (slippage)
                calculatedData.recipient,
                calculatedData.deadline,
            ];

            const calldata = ethers.utils.defaultAbiCoder.encode(
                ['address', 'address', 'uint24', 'int24', 'int24', 'uint256', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
                mintParams
            );

            const tx = {
                to: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
                from: currentAccount,
                data: '0x88316456' + calldata.slice(2),
            };

            console.log('Sending transaction:', tx);
            txStatusEl.textContent = 'Please confirm the transaction in your wallet.';
            const txResponse = await signer.sendTransaction(tx);
            txStatusEl.textContent = `Transaction sent! Hash: ${txResponse.hash}. Waiting for confirmation...`;
            const receipt = await txResponse.wait();
            txStatusEl.textContent = `Transaction confirmed in block ${receipt.blockNumber}!`;
            txLinkEl.href = `https://bscscan.com/tx/${receipt.transactionHash}`;
            txLinkContainerEl.style.display = 'block';
            console.log('Transaction successful!', receipt);

        } catch (error) {
            console.error('Transaction failed:', error);
            txStatusEl.textContent = `Error: ${error.message}`;
        }
    }

    // --- Event Listeners ---
    connectWalletBtn.addEventListener('click', connectWallet);
    document.getElementById('poolAddress').addEventListener('blur', fetchAndSetCurrentTick);
    fetchDataBtn.addEventListener('click', fetchAndCalculate);
    liquidityForm.addEventListener('submit', submitTransaction);

    // --- Initial Load ---
    connectWallet();
});
