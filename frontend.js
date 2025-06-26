import { ethers } from 'ethers';
import { Token } from '@pancakeswap/swap-sdk-core';
import { Pool, Position } from '@pancakeswap/v3-sdk';

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const connectWalletBtn = document.getElementById('connectWalletBtn');
  const walletInfoEl = document.getElementById('wallet-info');
  const networkStatusEl = document.getElementById('networkStatus');
  const accountStatusEl = document.getElementById('accountStatus');
  const fetchDataBtn = document.getElementById('fetchDataBtn');
  const liquidityForm = document.getElementById('liquidityForm');
  const txStatusEl = document.getElementById('txStatus');
  const txLinkEl = document.getElementById('txLink');
  const txLinkContainerEl = document.getElementById('txLinkContainer');
  const liveDataEl = document.getElementById('liveData');
  const fetchPositionsBtn = document.getElementById('fetchPositionsBtn');
  const positionsListEl = document.getElementById('positionsList');
  const disconnectBtn = document.getElementById('disconnectBtn');

  // --- Constants ---
  const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364';
  const BSC_CHAIN_ID = 56;
  const PANCAKE_V3_FACTORY_ADDRESS = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865'; // BSC Mainnet
  const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; // BSC Mainnet USDT

  // --- ABIs ---
  const ERC20_ABI = [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
  ];
  const NFPM_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
    'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint256 tokensOwed0, uint256 tokensOwed1)',
    'function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) payable returns (uint256 amount0, uint256 amount1)',
    'function decreaseLiquidity(tuple(uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) payable returns (uint256 amount0, uint256 amount1)',
  ];

  const POOL_ABI = [
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function fee() view returns (uint24)',
    'function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)',
    'function liquidity() view returns (uint128)',
  ];

  // --- State ---
  let provider, signer;
  let calculatedData = {}; // To store fetched & calculated data for the transaction

  // --- Helpers ---
  function truncateAddress(address) {
    if (!address) return '';
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
  }

  // --- Wallet & UI Functions ---
  async function connectWallet() {
    if (window.ethereum) {
      try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        signer = provider.getSigner();
        await updateWalletStatus();
      } catch (err) {
        console.error('User rejected connection:', err);
        alert('Could not connect to wallet. Please approve the connection in MetaMask.');
      }
    } else {
      alert('MetaMask is not installed. Please install it to use this app.');
    }
  }

  function disconnectWallet() {
    setDisconnectedState();
  }

  function setDisconnectedState() {
    signer = null;

    connectWalletBtn.classList.remove('hidden');
    walletInfoEl.classList.add('hidden');
    fetchPositionsBtn.disabled = true;
    liquidityForm.querySelector('button').disabled = true;
    positionsListEl.innerHTML = ''; // Clear positions if disconnected
  }

  async function updateWalletStatus() {
    if (!signer) {
      setDisconnectedState();
      return;
    }

    try {
      const account = await signer.getAddress();
      const network = await provider.getNetwork();

      if (!account) {
        // Explicitly check for a valid account
        throw new Error('Account not found or wallet is locked.');
      }

      connectWalletBtn.classList.add('hidden');
      walletInfoEl.classList.remove('hidden');

      if (network.chainId !== BSC_CHAIN_ID) {
        networkStatusEl.textContent = 'Wrong Network!';
        networkStatusEl.style.color = '#ff6b6b';
        accountStatusEl.textContent = 'Please switch to BNB Chain';
        fetchPositionsBtn.disabled = true;
        liquidityForm.querySelector('button').disabled = true;
      } else {
        networkStatusEl.textContent = 'BNB Chain';
        networkStatusEl.style.color = 'inherit';
        accountStatusEl.textContent = truncateAddress(account);
        fetchPositionsBtn.disabled = false;
        liquidityForm.querySelector('button').disabled = false;
      }
    } catch (error) {
      console.error('Failed to update wallet status, resetting UI.', error);
      setDisconnectedState();
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
        document.getElementById('tickUpper').value = currentTick + 1;
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
    document.getElementById('pool-stats-container').classList.add('hidden'); // Hide stats initially

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

      const account = await signer.getAddress();

      const [token0Decimals, token1Decimals, token0Symbol, token1Symbol, token0Balance, token1Balance] =
        await Promise.all([
          token0Contract.decimals(),
          token1Contract.decimals(),
          token0Contract.symbol(),
          token1Contract.symbol(),
          token0Contract.balanceOf(account),
          token1Contract.balanceOf(account),
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
        recipient: account,
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

      // --- 7. Fetch and display pool stats ---
      const poolStatsEl = document.getElementById('pool-stats');
      const poolStatsContainer = document.getElementById('pool-stats-container');
      try {
        const response = await fetch(
          `https://explorer.pancakeswap.com/api/cached/pools/v3/bsc/${poolAddress.toLowerCase()}`
        );
        const data = await response.json();
        if (data && data.tvlUSD) {
          const formatCurrency = (value) =>
            `$${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

          poolStatsEl.innerHTML = `
            <div>
                <div class="stat-label">Total Value Locked (TVL)</div>
                <div class="stat-value">${formatCurrency(data.tvlUSD)}</div>
            </div>
            <div>
                <div class="stat-label">Volume (24h)</div>
                <div class="stat-value">${formatCurrency(data.volumeUSD24h)}</div>
            </div>
            <div>
                <div class="stat-label">Fees (24h)</div>
                <div class="stat-value">${formatCurrency(data.feeUSD24h)}</div>
            </div>
          `;
          poolStatsContainer.classList.remove('hidden');
        } else {
          poolStatsContainer.classList.add('hidden');
        }
      } catch (e) {
        console.error('Could not fetch pool stats:', e);
        poolStatsContainer.classList.add('hidden');
      }
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
    const allowance = await tokenContract.allowance(await signer.getAddress(), NONFUNGIBLE_POSITION_MANAGER_ADDRESS);
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
        [
          'address',
          'address',
          'uint24',
          'int24',
          'int24',
          'uint256',
          'uint256',
          'uint256',
          'uint256',
          'address',
          'uint256',
        ],
        mintParams
      );

      const tx = {
        to: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
        from: await signer.getAddress(),
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

  async function fetchPositions() {
    if (!signer) return alert('Please connect your wallet first.');

    positionsListEl.innerHTML = 'Fetching positions...';

    try {
      const account = await signer.getAddress();
      const nfpmContract = new ethers.Contract(NONFUNGIBLE_POSITION_MANAGER_ADDRESS, NFPM_ABI, provider);
      const balance = await nfpmContract.balanceOf(account);

      if (balance.isZero()) {
        positionsListEl.innerHTML = '<p>No liquidity positions found.</p>';
        return;
      }

      positionsListEl.innerHTML = ''; // Clear the 'Fetching...' message

      const positionPromises = [];
      for (let i = 0; i < balance.toNumber(); i++) {
        positionPromises.push(nfpmContract.tokenOfOwnerByIndex(account, i));
      }

      const tokenIds = await Promise.all(positionPromises);
      const MAX_UINT128 = ethers.BigNumber.from(2).pow(128).sub(1);

      for (const tokenId of tokenIds) {
        const positionInfo = await nfpmContract.positions(tokenId);

        if (positionInfo.liquidity.isZero()) {
          console.log(`Skipping inactive position (zero liquidity) - Token ID: ${tokenId.toString()}`);
          continue;
        }

        const token0Contract = new ethers.Contract(positionInfo.token0, ERC20_ABI, provider);
        const token1Contract = new ethers.Contract(positionInfo.token1, ERC20_ABI, provider);

        const [token0Symbol, token1Symbol, token0Decimals, token1Decimals] = await Promise.all([
          token0Contract.symbol(),
          token1Contract.symbol(),
          token0Contract.decimals(),
          token1Contract.decimals(),
        ]);

        const token0 = new Token(BSC_CHAIN_ID, positionInfo.token0, token0Decimals, token0Symbol);
        const token1 = new Token(BSC_CHAIN_ID, positionInfo.token1, token1Decimals, token1Symbol);

        // --- Calculate unclaimed fees ---
        const collectParams = {
          tokenId: tokenId,
          recipient: account, // Fees will be sent to the user's address
          amount0Max: MAX_UINT128,
          amount1Max: MAX_UINT128,
        };

        const fees = await nfpmContract.callStatic.collect(collectParams, { from: account });
        const feeAmount0 = ethers.utils.formatUnits(fees.amount0, token0.decimals);
        const feeAmount1 = ethers.utils.formatUnits(fees.amount1, token1.decimals);

        // --- Calculate underlying token amounts ---
        const factoryContract = new ethers.Contract(
          PANCAKE_V3_FACTORY_ADDRESS,
          ['function getPool(address,address,uint24) view returns (address)'],
          provider
        );
        const [sortedToken0, sortedToken1] = token0.sortsBefore(token1) ? [token0, token1] : [token1, token0];
        const poolAddress = await factoryContract.getPool(sortedToken0.address, sortedToken1.address, positionInfo.fee);

        if (poolAddress === ethers.constants.AddressZero) {
          console.warn(
            `Pool not found for tokens ${token0.symbol}/${token1.symbol} and fee ${positionInfo.fee}. Skipping position ${tokenId.toString()}.`
          );
          continue;
        }

        const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);
        const [slot0, poolLiquidity] = await Promise.all([poolContract.slot0(), poolContract.liquidity()]);

        const pool = new Pool(
          token0,
          token1,
          positionInfo.fee,
          slot0[0].toString(), // sqrtPriceX96
          poolLiquidity.toString(),
          slot0[1] // tick
        );

        const position = new Position({
          pool: pool,
          liquidity: positionInfo.liquidity.toString(),
          tickLower: positionInfo.tickLower,
          tickUpper: positionInfo.tickUpper,
        });

        const amount0 = ethers.utils.formatUnits(position.amount0.quotient.toString(), token0.decimals);
        const amount1 = ethers.utils.formatUnits(position.amount1.quotient.toString(), token1.decimals);

        // --- Calculate USD value of fees ---
        let price0Usd = null;
        let price1Usd = null;

        if (token0.address.toLowerCase() === USDT_ADDRESS.toLowerCase()) {
          price0Usd = 1;
          price1Usd = parseFloat(pool.token1Price.toSignificant(18));
        } else if (token1.address.toLowerCase() === USDT_ADDRESS.toLowerCase()) {
          price1Usd = 1;
          price0Usd = parseFloat(pool.token0Price.toSignificant(18));
        }

        let estimatedFeeValue = null;
        if (price0Usd !== null && price1Usd !== null) {
          const feeValue0 = parseFloat(feeAmount0) * price0Usd;
          const feeValue1 = parseFloat(feeAmount1) * price1Usd;
          estimatedFeeValue = feeValue0 + feeValue1;
        }
        // --- End of calculation ---

        const positionHTML = `
                    <div class="position-item" style="border: 1px solid #444; padding: 1rem; margin-bottom: 1rem; border-radius: 8px;" id="position-${tokenId.toString()}">
                        <h4>Position - Token ID: ${tokenId.toString()}</h4>
                        <p><strong>Tokens:</strong> ${token0Symbol} / ${token1Symbol}</p>
                        <p><strong>Fee Tier:</strong> ${positionInfo.fee / 10000}%</p>
                        <p><strong>Tick Range:</strong> ${positionInfo.tickLower} to ${positionInfo.tickUpper}</p>
                        <p><strong>Liquidity (Raw):</strong> ${positionInfo.liquidity.toString()}</p>
                        <p style="color: #28a745;"><strong>Underlying ${token0Symbol}:</strong> ${parseFloat(amount0).toPrecision(6)}</p>
                        <p style="color: #28a745;"><strong>Underlying ${token1Symbol}:</strong> ${parseFloat(amount1).toPrecision(6)}</p>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
                            <p style="color: #ffc107; margin: 0;"><strong>Unclaimed Fees:</strong> ${parseFloat(feeAmount0).toPrecision(4)} ${token0Symbol} & ${parseFloat(feeAmount1).toPrecision(4)} ${token1Symbol} ${estimatedFeeValue !== null ? `(~$${estimatedFeeValue.toFixed(2)})` : ''}</p>
                            <div>
                                <button class="remove-liquidity-btn" data-tokenid="${tokenId.toString()}">Remove</button>
                                <button class="claim-btn" data-tokenid="${tokenId.toString()}">Claim Fees</button>
                            </div>
                        </div>
                        <div class="remove-liquidity-section" id="remove-section-${tokenId.toString()}" style="display:none; margin-top: 1rem; background: #3a3a4f; padding: 1rem; border-radius: 8px;">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center;">
                                    <label for="remove-percentage-${tokenId.toString()}" style="margin-right: 10px; white-space: nowrap;">Percentage to remove:</label>
                                    <input type="number" id="remove-percentage-${tokenId.toString()}" min="1" max="100" value="100" style="width: 70px; margin-right: 5px;">
                                    <span style="margin-right: 15px;">%</span>
                                </div>
                                <button class="confirm-remove-btn" data-tokenid="${tokenId.toString()}" data-liquidity="${position.liquidity.toString()}">Confirm</button>
                            </div>
                            <p class="remove-status" style="margin-top: 1rem; font-size: 0.9em; text-align: center;"></p>
                        </div>
                        <p class="claim-status" style="margin-top: 0.25rem; font-size: 0.9em;"></p>
                    </div>
                `;
        positionsListEl.innerHTML += positionHTML;
      }
    } catch (error) {
      console.error('Failed to fetch positions:', error);
      positionsListEl.innerHTML = `<p style="color:red;">Error fetching positions: ${error.message}</p>`;
    }
  }

  async function claimFees(event) {
    if (!event.target.classList.contains('claim-btn')) return;

    const tokenId = event.target.dataset.tokenid;
    const statusEl = document.querySelector(`#position-${tokenId} .claim-status`);

    if (!signer) {
      return alert('Please connect your wallet first.');
    }

    statusEl.textContent = 'Preparing to claim...';
    event.target.disabled = true;

    try {
      const account = await signer.getAddress();
      const nfpmContract = new ethers.Contract(NONFUNGIBLE_POSITION_MANAGER_ADDRESS, NFPM_ABI, signer);
      const MAX_UINT128 = ethers.BigNumber.from(2).pow(128).sub(1);

      const collectParams = {
        tokenId: tokenId,
        recipient: account,
        amount0Max: MAX_UINT128,
        amount1Max: MAX_UINT128,
      };

      statusEl.textContent = 'Please confirm the transaction in your wallet...';
      const tx = await nfpmContract.collect(collectParams);
      statusEl.innerHTML = `Claim Tx: <a href="https://bscscan.com/tx/${tx.hash}" target="_blank" style="color: #a9a9ff;">${tx.hash.substring(0, 10)}...${tx.hash.substring(tx.hash.length - 10)}</a><br>Waiting for confirmation...`;

      const receipt = await tx.wait();
      statusEl.textContent = `Fees claimed successfully! Transaction confirmed in block ${receipt.blockNumber}.`;

      // Refresh positions to show updated fee amounts
      setTimeout(fetchPositions, 2000);
    } catch (error) {
      console.error('Failed to claim fees:', error);
      statusEl.textContent = `Error: ${error.message}`;
      event.target.disabled = false;
    }
  }

  // --- Event Listeners ---
  connectWalletBtn.addEventListener('click', connectWallet);
  document.getElementById('poolAddress').addEventListener('blur', fetchAndSetCurrentTick);
  fetchDataBtn.addEventListener('click', fetchAndCalculate);
  liquidityForm.addEventListener('submit', submitTransaction);
  fetchPositionsBtn.addEventListener('click', fetchPositions);
  positionsListEl.addEventListener('click', handlePositionsClick);
  disconnectBtn.addEventListener('click', disconnectWallet);

  async function handlePositionsClick(event) {
    if (event.target.classList.contains('claim-btn')) {
      claimFees(event);
    }
    if (event.target.classList.contains('remove-liquidity-btn')) {
      const tokenId = event.target.dataset.tokenid;
      const removeSection = document.getElementById(`remove-section-${tokenId}`);
      removeSection.style.display = removeSection.style.display === 'none' ? 'block' : 'none';
    }
    if (event.target.classList.contains('confirm-remove-btn')) {
      removeLiquidity(event);
    }
  }

  async function removeLiquidity(event) {
    const tokenId = event.target.dataset.tokenid;
    const totalLiquidity = ethers.BigNumber.from(event.target.dataset.liquidity);
    const percentage = document.getElementById(`remove-percentage-${tokenId}`).value;
    const statusEl = document.querySelector(`#remove-section-${tokenId} .remove-status`);

    if (!percentage || percentage <= 0 || percentage > 100) {
      return (statusEl.textContent = 'Please enter a valid percentage (1-100).');
    }

    statusEl.textContent = 'Preparing to remove liquidity...';
    event.target.disabled = true;

    try {
      const liquidityToRemove = totalLiquidity.mul(percentage).div(100);

      const nfpmContract = new ethers.Contract(NONFUNGIBLE_POSITION_MANAGER_ADDRESS, NFPM_ABI, signer);

      // 1. Decrease Liquidity
      const decreaseParams = {
        tokenId: tokenId,
        liquidity: liquidityToRemove,
        amount0Min: 0, // For simplicity, we don't set a slippage protection
        amount1Min: 0,
        deadline: Math.floor(Date.now() / 1000) + 60 * 20,
      };

      statusEl.textContent = 'Decreasing liquidity... Please confirm in wallet.';
      const decreaseTx = await nfpmContract.decreaseLiquidity(decreaseParams);
      statusEl.innerHTML = `Decrease Tx: <a href="https://bscscan.com/tx/${decreaseTx.hash}" target="_blank" style="color: #a9a9ff;">${decreaseTx.hash.substring(0, 10)}...${decreaseTx.hash.substring(decreaseTx.hash.length - 10)}</a><br>Waiting for confirmation...`;
      await decreaseTx.wait();
      statusEl.textContent = 'Liquidity decreased. Now collecting tokens...';

      // 2. Collect the tokens
      const MAX_UINT128 = ethers.BigNumber.from(2).pow(128).sub(1);
      const account = await signer.getAddress();
      const collectParams = {
        tokenId: tokenId,
        recipient: account,
        amount0Max: MAX_UINT128,
        amount1Max: MAX_UINT128,
      };

      statusEl.textContent = 'Collecting tokens... Please confirm in wallet.';
      const collectTx = await nfpmContract.collect(collectParams);
      statusEl.innerHTML = `Collect Tx: <a href="https://bscscan.com/tx/${collectTx.hash}" target="_blank" style="color: #a9a9ff;">${collectTx.hash.substring(0, 10)}...${collectTx.hash.substring(collectTx.hash.length - 10)}</a><br>Waiting for confirmation...`;
      await collectTx.wait();

      statusEl.textContent = 'Liquidity successfully removed and tokens collected!';

      // Refresh positions to show updated state
      setTimeout(fetchPositions, 2000);
    } catch (error) {
      console.error('Failed to remove liquidity:', error);
      statusEl.textContent = `Error: ${error.message}`;
      event.target.disabled = false;
    }
  }

  // --- Initial Load ---
  async function initialize() {
    if (!window.ethereum) {
      setDisconnectedState();
      return;
    }

    provider = new ethers.providers.Web3Provider(window.ethereum);

    // Set up listeners for real-time events
    window.ethereum.on('accountsChanged', async (accounts) => {
      if (accounts.length > 0) {
        signer = provider.getSigner();
      } else {
        signer = null;
      }
      await updateWalletStatus();
    });
    window.ethereum.on('chainChanged', () => window.location.reload());

    // Perform a robust initial connection check
    try {
      const accounts = await provider.listAccounts();
      if (accounts.length === 0) {
        // No accounts are connected to the site
        setDisconnectedState();
        return;
      }

      signer = provider.getSigner();
      // This is the crucial test: it will fail if the wallet is locked.
      await signer.getAddress();

      // If we successfully get an address, we are connected and unlocked.
      await updateWalletStatus();
    } catch (error) {
      // This catches any error during the initial check (e.g., locked wallet)
      console.log('Initial connection check failed, setting UI to disconnected.', error.message);
      setDisconnectedState();
    }
  }

  initialize();
});
