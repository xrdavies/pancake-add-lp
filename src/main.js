import { initializeWallet, disconnectWallet } from './wallet.js';
import * as ui from './ui.js';
import * as pancakeswap from './pancakeswap.js';

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const connectWalletBtn = document.getElementById('connectWalletBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  const walletInfoEl = document.getElementById('wallet-info');
  const networkStatusEl = document.getElementById('networkStatus');
  const accountStatusEl = document.getElementById('accountStatus');
  const fetchDataBtn = document.getElementById('fetchDataBtn');
  const liquidityForm = document.getElementById('liquidityForm');
  const addLiquidityBtn = document.getElementById('addLiquidityBtn');
  const txStatusEl = document.getElementById('txStatus');
  const txLinkContainerEl = document.getElementById('txLinkContainer');
  const liveDataEl = document.getElementById('liveData');
  const fetchPositionsBtn = document.getElementById('fetchPositionsBtn');
  const positionsListEl = document.getElementById('positionsList');
  const poolAddressInput = document.getElementById('poolAddress');
  const poolStatsContainer = document.getElementById('pool-stats-container');
  const poolStatsEl = document.getElementById('pool-stats');

  // --- Initialize UI Module ---
  ui.setDOMElements({
    connectWalletBtn,
    disconnectBtn,
    walletInfoEl,
    networkStatusEl,
    accountStatusEl,
    fetchDataBtn,
    addLiquidityBtn,
    fetchPositionsBtn,
    positionsListEl,
    liveDataEl,
    txStatusEl,
    txLinkContainerEl,
    liquidityForm,
    poolStatsContainer,
    poolStatsEl,
  });

  // --- Event Listeners ---
  connectWalletBtn.addEventListener('click', initializeWallet);
  disconnectBtn.addEventListener('click', disconnectWallet);
  poolAddressInput.addEventListener('blur', pancakeswap.fetchAndSetCurrentTick);
  fetchDataBtn.addEventListener('click', pancakeswap.fetchAndCalculate);
  addLiquidityBtn.addEventListener('click', pancakeswap.submitTransaction);
  fetchPositionsBtn.addEventListener('click', pancakeswap.fetchPositions);
  positionsListEl.addEventListener('click', handlePositionsClick);

  function handlePositionsClick(event) {
    const target = event.target;
    const tokenId = target.dataset.tokenid;

    if (target.classList.contains('claim-btn')) {
      pancakeswap.claimFees(tokenId);
    }
    if (target.classList.contains('remove-liquidity-btn')) {
      const removeSection = document.getElementById(`remove-section-${tokenId}`);
      if (removeSection) {
        removeSection.style.display = removeSection.style.display === 'none' ? 'block' : 'none';
      }
    }
    if (target.classList.contains('confirm-remove-btn')) {
      pancakeswap.removeLiquidity(tokenId);
    }
  }

  // --- Initial Load ---
  initializeWallet();
});
