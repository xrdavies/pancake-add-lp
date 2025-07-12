import { truncateAddress } from './utils.js';

// --- DOM Elements ---
let connectWalletBtn,
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
  poolStatsEl;

export function setDOMElements(elements) {
  connectWalletBtn = elements.connectWalletBtn;
  disconnectBtn = elements.disconnectBtn;
  walletInfoEl = elements.walletInfoEl;
  networkStatusEl = elements.networkStatusEl;
  accountStatusEl = elements.accountStatusEl;
  fetchDataBtn = elements.fetchDataBtn;
  addLiquidityBtn = elements.addLiquidityBtn;
  fetchPositionsBtn = elements.fetchPositionsBtn;
  positionsListEl = elements.positionsListEl;
  liveDataEl = elements.liveDataEl;
  txStatusEl = elements.txStatusEl;
  txLinkContainerEl = elements.txLinkContainerEl;
  liquidityForm = elements.liquidityForm;
  poolStatsContainer = elements.poolStatsContainer;
  poolStatsEl = elements.poolStatsEl;
}

export function showConnectedState(account, network, bscChainId) {
  connectWalletBtn.classList.add('hidden');
  walletInfoEl.classList.remove('hidden');

  if (network.chainId !== bscChainId) {
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
}

export function showDisconnectedState() {
  connectWalletBtn.classList.remove('hidden');
  walletInfoEl.classList.add('hidden');
  fetchDataBtn.disabled = true;
  addLiquidityBtn.disabled = true;
  fetchPositionsBtn.disabled = true;
  positionsListEl.innerHTML = '';
  liveDataEl.innerHTML = '<p>Calculated data will appear here...</p>';
  poolStatsContainer.classList.add('hidden');
  txStatusEl.textContent = '';
  txLinkContainerEl.classList.add('hidden');
}

export function updateLiveData(content) {
  liveDataEl.innerHTML = content;
}

export function updateTxStatus(content) {
  txStatusEl.innerHTML = content;
}

export function showTxLink(hash) {
  const txLink = document.getElementById('txLink');
  txLink.href = `https://bscscan.com/tx/${hash}`;
  txLinkContainerEl.classList.remove('hidden');
}

export function hideTxLink() {
  txLinkContainerEl.classList.add('hidden');
}

export function updatePositionsList(content) {
  positionsListEl.innerHTML = content;
}

export function renderPositions(positions) {
  if (!positions || positions.length === 0) {
    positionsListEl.innerHTML = '<p>No liquidity positions found.</p>';
    return;
  }

  const positionsHTML = positions
    .map((pos) => {
      const feeValue = pos.estimatedFeeValue !== null ? `(~$${pos.estimatedFeeValue.toFixed(2)})` : '';
      return `
        <div class="position-item" style="border: 1px solid #444; padding: 1rem; margin-bottom: 1rem; border-radius: 8px;" id="position-${pos.tokenId}">
            <h4>Position - Token ID: ${pos.tokenId}</h4>
            <p><strong>Tokens:</strong> ${pos.token0Symbol} / ${pos.token1Symbol}</p>
            <p><strong>Fee Tier:</strong> ${pos.fee / 10000}%</p>
            <p><strong>Tick Range:</strong> ${pos.tickLower} to ${pos.tickUpper}</p>
            <p><strong>Liquidity (Raw):</strong> ${pos.liquidity}</p>
            <p style="color: #28a745;"><strong>Underlying ${pos.token0Symbol}:</strong> ${parseFloat(pos.amount0).toPrecision(6)}</p>
            <p style="color: #28a745;"><strong>Underlying ${pos.token1Symbol}:</strong> ${parseFloat(pos.amount1).toPrecision(6)}</p>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
                <p style="color: #ffc107; margin: 0;"><strong>Unclaimed Fees:</strong> ${parseFloat(pos.feeAmount0).toPrecision(4)} ${pos.token0Symbol} & ${parseFloat(pos.feeAmount1).toPrecision(4)} ${pos.token1Symbol} ${feeValue}</p>
                <div>
                    <button class="remove-liquidity-btn" data-tokenid="${pos.tokenId}">Remove</button>
                    <button class="claim-btn" data-tokenid="${pos.tokenId}">Claim Fees</button>
                </div>
            </div>
            <div class="remove-liquidity-section" id="remove-section-${pos.tokenId}" style="display:none; margin-top: 1rem; background: #3a3a4f; padding: 1rem; border-radius: 8px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center;">
                        <label for="remove-percentage-${pos.tokenId}" style="margin-right: 10px; white-space: nowrap;">Percentage to remove:</label>
                        <input type="number" id="remove-percentage-${pos.tokenId}" min="1" max="100" value="100" style="width: 70px; margin-right: 5px;">
                        <span style="margin-right: 15px;">%</span>
                    </div>
                    <button class="confirm-remove-btn" data-tokenid="${pos.tokenId}" data-liquidity="${pos.liquidity}">Confirm</button>
                </div>
                <p class="remove-status" style="margin-top: 1rem; font-size: 0.9em; text-align: center;"></p>
            </div>
            <p class="claim-status" style="margin-top: 0.25rem; font-size: 0.9em;"></p>
        </div>
    `;
    })
    .join('');

  positionsListEl.innerHTML = positionsHTML;
}

export function updatePoolStats(stats) {
  if (!stats || !stats.tvlUSD || !stats.volumeUSD) {
    poolStatsContainer.classList.add('hidden');
    return;
  }

  poolStatsEl.innerHTML = `
        <div>
            <div class="stat-label">TVL</div>
            <div class="stat-value">$${stats.tvlUSD}</div>
        </div>
        <div>
            <div class="stat-label">Volume (24h)</div>
            <div class="stat-value">$${stats.volumeUSD}</div>
        </div>
         <div>
            <div class="stat-label">Fees (24h)</div>
            <div class="stat-value">$${stats.feesUSD}</div>
        </div>
        <div>
            <div class="stat-label">APR (24h)</div>
            <div class="stat-value">${stats.apr}%</div>
        </div>
    `;
  poolStatsContainer.classList.remove('hidden');
}
