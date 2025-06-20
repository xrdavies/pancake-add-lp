document.addEventListener('DOMContentLoaded', () => {
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    const walletStatusEl = document.getElementById('walletStatus');
    const networkStatusEl = document.getElementById('networkStatus');
    const switchNetworkBtn = document.getElementById('switchNetworkBtn');
    const accountStatusEl = document.getElementById('accountStatus');
    const liquidityForm = document.getElementById('liquidityForm');
    const recipientInput = document.getElementById('recipient');
    const deadlineInput = document.getElementById('deadline');
    const txStatusEl = document.getElementById('txStatus');
    const txLinkContainerEl = document.getElementById('txLinkContainer');
    const txLinkEl = document.getElementById('txLink');

    const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364'; // BSC Mainnet - Nonfungible Position Manager
    const BSC_CHAIN_ID = '0x38'; // 56 in decimal
    const BSC_CHAIN_ID_DECIMAL = 56;

    const bscNetworkConfig = {
        chainId: BSC_CHAIN_ID,
        chainName: 'BNB Smart Chain Mainnet',
        nativeCurrency: {
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18,
        },
        rpcUrls: ['https://bsc-dataseed.binance.org/'],
        blockExplorerUrls: ['https://bscscan.com'],
    };

    let provider;
    let signer;
    let currentAccount;

    // Helper function to re-initialize provider and update UI
    async function refreshProviderAndUI() {
        console.log('Refreshing provider and UI...');
        if (typeof window.ethereum === 'undefined') {
            console.log('window.ethereum is undefined in refreshProviderAndUI.');
            walletStatusEl.textContent = 'Error: MetaMask (window.ethereum) not found during refresh.';
            networkStatusEl.style.color = 'red';
            return;
        }

        try {
            provider = new ethers.providers.Web3Provider(window.ethereum); // Re-initialize
            signer = provider.getSigner();
            currentAccount = await signer.getAddress();
            const network = await provider.getNetwork();
            console.log('Refreshed network details:', network);

            if (network.chainId === BSC_CHAIN_ID_DECIMAL) {
                networkStatusEl.textContent = `Network: ${network.name} (ID: ${network.chainId})`;
                networkStatusEl.style.color = 'green';
                switchNetworkBtn.style.display = 'none';
                console.log('Successfully on BSC Mainnet.');
            } else {
                networkStatusEl.textContent = `Network: Wrong Network! Please switch to BSC Mainnet (Chain ID ${BSC_CHAIN_ID_DECIMAL}). Current: ${network.name} (${network.chainId})`;
                networkStatusEl.style.color = 'red';
                switchNetworkBtn.style.display = 'block';
                console.log('Still on wrong network after refresh attempt.');
            }
            accountStatusEl.textContent = `Account: ${currentAccount}`;
            walletStatusEl.textContent = 'Status: Connected';
            walletStatusEl.style.color = 'green';
            // Update recipient only if it's empty or hasn't been set to the current account yet
            if (!recipientInput.value || recipientInput.value !== currentAccount) {
                 recipientInput.value = currentAccount;
            }
        } catch (error) {
            console.error('Error during refreshProviderAndUI:', error);
            walletStatusEl.textContent = 'Status: Error refreshing wallet state.';
            walletStatusEl.style.color = 'red';
            networkStatusEl.textContent = 'Check console for errors.';
            networkStatusEl.style.color = 'red';
        }
    }

    // Set default deadline (10 minutes from now)
    deadlineInput.value = Math.floor(Date.now() / 1000) + 600;

    connectWalletBtn.addEventListener('click', async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                provider = new ethers.providers.Web3Provider(window.ethereum);
                await provider.send('eth_requestAccounts', []);
                signer = provider.getSigner();
                currentAccount = await signer.getAddress();
                
                walletStatusEl.textContent = 'Status: Connected';
                accountStatusEl.textContent = `Account: ${currentAccount}`;
                recipientInput.value = currentAccount;

                const network = await provider.getNetwork();
                if (network.chainId !== BSC_CHAIN_ID_DECIMAL) {
                    networkStatusEl.textContent = `Network: Wrong Network! Please switch to BSC Mainnet (Chain ID ${BSC_CHAIN_ID_DECIMAL}). Current: ${network.name} (${network.chainId})`;
                    networkStatusEl.style.color = 'red';
                    switchNetworkBtn.style.display = 'block';
                } else {
                    networkStatusEl.textContent = `Network: ${network.name}`;
                    networkStatusEl.style.color = 'green';
                    switchNetworkBtn.style.display = 'none';
                }

            } catch (error) {
                console.error('Error connecting wallet:', error);
                walletStatusEl.textContent = `Error: ${error.message}`;
            }
        } else {
            walletStatusEl.textContent = 'MetaMask is not installed!';
        }
    });

        // Helper function to re-initialize provider and update UI
    async function refreshProviderAndUI() {
        console.log('Refreshing provider and UI...');
        if (typeof window.ethereum === 'undefined') {
            console.log('window.ethereum is undefined in refreshProviderAndUI.');
            walletStatusEl.textContent = 'Error: MetaMask (window.ethereum) not found during refresh.';
            return;
        }

        try {
            provider = new ethers.providers.Web3Provider(window.ethereum); // Re-initialize
            signer = provider.getSigner();
            currentAccount = await signer.getAddress();
            const network = await provider.getNetwork();
            console.log('Refreshed network details:', network);

            if (network.chainId === BSC_CHAIN_ID_DECIMAL) {
                networkStatusEl.textContent = `Network: ${network.name} (ID: ${network.chainId})`;
                networkStatusEl.style.color = 'green';
                switchNetworkBtn.style.display = 'none';
                console.log('Successfully on BSC Mainnet.');
            } else {
                networkStatusEl.textContent = `Network: Wrong Network! Please switch to BSC Mainnet (Chain ID ${BSC_CHAIN_ID_DECIMAL}). Current: ${network.name} (${network.chainId})`;
                networkStatusEl.style.color = 'red';
                switchNetworkBtn.style.display = 'block';
                console.log('Still on wrong network after refresh attempt.');
            }
            accountStatusEl.textContent = `Account: ${currentAccount}`;
            // Update recipient only if it's empty or hasn't been set to the current account yet
            // This avoids overwriting if the user manually changed it after connecting.
            if (!recipientInput.value || recipientInput.value !== currentAccount) {
                 recipientInput.value = currentAccount;
            }
        } catch (error) {
            console.error('Error during refreshProviderAndUI:', error);
            networkStatusEl.textContent = 'Error refreshing wallet state. Check console.';
            networkStatusEl.style.color = 'red';
        }
    }

    switchNetworkBtn.addEventListener('click', async () => {
        console.log('"Switch to BSC Mainnet" button clicked.');
        try {
            console.log('Attempting to switch to BSC Mainnet via wallet_switchEthereumChain...');
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: BSC_CHAIN_ID }],
            });
            console.log('wallet_switchEthereumChain request completed without throwing an immediate error.');
            await refreshProviderAndUI(); // Refresh after successful request
        } catch (switchError) {
            console.warn('Error during wallet_switchEthereumChain:', switchError);
            if (switchError.code === 4902) { // Standard RPC error: Chain not added
                console.log('BSC Mainnet (Chain ID 4902) not added. Attempting to add...');
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [bscNetworkConfig],
                    });
                    console.log('wallet_addEthereumChain request completed.');
                    await refreshProviderAndUI(); // Refresh after successful add
                } catch (addError) {
                    console.error('Failed to add BSC Mainnet:', addError);
                    networkStatusEl.textContent = 'Failed to add BSC Mainnet. Please add it manually. Check console.';
                    networkStatusEl.style.color = 'red';
                }
            } else if (switchError.code === 'NETWORK_ERROR' || (switchError.message && switchError.message.toLowerCase().includes('underlying network changed'))) {
                console.warn('Caught ethers.js NETWORK_ERROR or "underlying network changed" message. Assuming switch occurred, refreshing provider.');
                await refreshProviderAndUI();
            } else {
                console.error('Failed to switch network (unhandled case):', switchError);
                let displayMessage = 'Failed to switch network.';
                if (switchError.message) {
                    displayMessage += ` Details: ${switchError.message.substring(0,100)}...`;
                }
                networkStatusEl.textContent = displayMessage;
                networkStatusEl.style.color = 'red';
            }
        }
    });

    liquidityForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        txStatusEl.textContent = '';
        txLinkContainerEl.style.display = 'none';

        if (!signer || !currentAccount) {
            txStatusEl.textContent = 'Please connect your wallet first.';
            return;
        }

        const network = await provider.getNetwork();
        if (network.chainId !== BSC_CHAIN_ID_DECIMAL) {
            txStatusEl.textContent = 'Cannot proceed. Please switch to BSC Mainnet.';
            return;
        }

        try {
            const token0 = document.getElementById('token0').value;
            const token0Decimals = parseInt(document.getElementById('token0Decimals').value);
            const token1 = document.getElementById('token1').value;
            const token1Decimals = parseInt(document.getElementById('token1Decimals').value);
            const fee = parseInt(document.getElementById('fee').value);
            const tickLower = parseInt(document.getElementById('tickLower').value);
            const tickUpper = parseInt(document.getElementById('tickUpper').value);
            const amount0DesiredStr = document.getElementById('amount0Desired').value;
            const amount1DesiredStr = document.getElementById('amount1Desired').value;
            const amount0MinStr = document.getElementById('amount0Min').value;
            const amount1MinStr = document.getElementById('amount1Min').value;
            const recipient = document.getElementById('recipient').value;
            const deadline = parseInt(document.getElementById('deadline').value);

            // Validate inputs
            if (!ethers.utils.isAddress(token0) || !ethers.utils.isAddress(token1) || !ethers.utils.isAddress(recipient)) {
                throw new Error('Invalid address provided for Token0, Token1, or Recipient.');
            }
            if (isNaN(token0Decimals) || isNaN(token1Decimals) || token0Decimals < 0 || token1Decimals < 0) {
                throw new Error('Invalid token decimals.');
            }
            // Add more validations as needed for fee, ticks, amounts

            const amount0Desired = ethers.utils.parseUnits(amount0DesiredStr, token0Decimals);
            const amount1Desired = ethers.utils.parseUnits(amount1DesiredStr, token1Decimals);
            const amount0Min = ethers.BigNumber.from(amount0MinStr); // Assuming raw value, can also parseUnits if needed
            const amount1Min = ethers.BigNumber.from(amount1MinStr); // Assuming raw value

            const mintParams = {
                token0: token0,
                token1: token1,
                fee: parseInt(fee),
                tickLower: parseInt(tickLower),
                tickUpper: parseInt(tickUpper),
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                recipient: recipient,
                deadline: Math.floor(Date.now() / 1000) + 600, // Fresh deadline: 10 minutes from now
            };

            const mintParamsAbi = [
                {
                    type: 'tuple',
                    name: 'params',
                    components: [
                        { name: 'token0', type: 'address' },
                        { name: 'token1', type: 'address' },
                        { name: 'fee', type: 'uint24' },
                        { name: 'tickLower', type: 'int24' },
                        { name: 'tickUpper', type: 'int24' },
                        { name: 'amount0Desired', type: 'uint256' },
                        { name: 'amount1Desired', type: 'uint256' },
                        { name: 'amount0Min', type: 'uint256' },
                        { name: 'amount1Min', type: 'uint256' },
                        { name: 'recipient', type: 'address' },
                        { name: 'deadline', type: 'uint256' },
                    ],
                },
            ];

            const abiCoder = new ethers.utils.AbiCoder();
            const encodedParams = abiCoder.encode(mintParamsAbi, [mintParams]);
            const methodId = '0x88316456'; // mint method selector
            const calldata = methodId + encodedParams.slice(2);

            txStatusEl.textContent = 'Preparing transaction... Please check MetaMask.';

            const tx = {
                to: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
                from: currentAccount,
                data: calldata,
            };

            const txResponse = await signer.sendTransaction(tx);
            txStatusEl.textContent = `Transaction submitted! Hash: ${txResponse.hash}. Waiting for confirmation...`;
            
            const receipt = await txResponse.wait();
            txStatusEl.textContent = `Transaction confirmed! Block number: ${receipt.blockNumber}`;
            txLinkEl.href = `https://bscscan.com/tx/${receipt.transactionHash}`;
            txLinkContainerEl.style.display = 'block';

        } catch (error) {
            console.error('Error during transaction:', error);
            txStatusEl.textContent = `Error: ${error.message}`;
        }
    });
});
