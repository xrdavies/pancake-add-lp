import { ethers } from 'ethers';
import { Token } from '@pancakeswap/swap-sdk-core';
import { Pool, Position } from '@pancakeswap/v3-sdk';
import * as ui from './ui.js';
import { provider, signer } from './wallet.js';

// --- Constants ---
const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364';
const PANCAKE_V3_FACTORY_ADDRESS = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865';
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const BSC_CHAIN_ID = 56;

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
  'function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
];
const POOL_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
  'function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)',
  'function liquidity() view returns (uint128)',
];

// --- State ---
let calculatedData = {};

export async function fetchAndSetCurrentTick() {
  const poolAddress = document.getElementById('poolAddress').value;
  const poolNameEl = document.getElementById('poolName');
  poolNameEl.textContent = '...'; // Show loading indicator

  if (!provider || !ethers.utils.isAddress(poolAddress)) {
    poolNameEl.textContent = '';
    return;
  }

  try {
    const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);

    const [slot0, token0Address, token1Address] = await Promise.all([
      poolContract.slot0(),
      poolContract.token0(),
      poolContract.token1(),
    ]);

    const currentTick = slot0[1]; // tick is at index 1
    if (currentTick !== undefined) {
      document.getElementById('tickLower').value = currentTick;
      document.getElementById('tickUpper').value = currentTick + 1;
    }

    const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
    const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, provider);
    const [token0Symbol, token1Symbol] = await Promise.all([token0Contract.symbol(), token1Contract.symbol()]);

    poolNameEl.textContent = `${token0Symbol}/${token1Symbol}`;
  } catch (error) {
    console.error('Could not fetch pool data:', error);
    poolNameEl.textContent = 'Invalid Pool';
  }
}

export async function fetchAndCalculate() {
  if (!signer) return alert('Please connect your wallet first.');

  const poolAddress = document.getElementById('poolAddress').value;
  const amount0DesiredStr = document.getElementById('amount0Desired').value;
  const tickLowerStr = document.getElementById('tickLower').value;
  const tickUpperStr = document.getElementById('tickUpper').value;

  if (!ethers.utils.isAddress(poolAddress) || !amount0DesiredStr || !tickLowerStr || !tickUpperStr) {
    return alert('Please fill in all required fields correctly.');
  }

  const tickLower = parseInt(tickLowerStr, 10);
  const tickUpper = parseInt(tickUpperStr, 10);

  if (isNaN(tickLower) || isNaN(tickUpper)) {
    return alert('Tick values must be valid numbers.');
  }

  if (tickLower >= tickUpper) {
    ui.updateLiveData(`<p style="color:red;">Error: Tick Lower must be less than Tick Upper.</p>`);
    return;
  }

  ui.updateLiveData('Fetching data...');
  ui.updatePoolStats(null);

  try {
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

    const TOKEN0 = new Token(BSC_CHAIN_ID, token0Addr, token0Decimals, token0Symbol);
    const TOKEN1 = new Token(BSC_CHAIN_ID, token1Addr, token1Decimals, token1Symbol);

    const pool = new Pool(TOKEN0, TOKEN1, fee, slot0[0].toString(), liquidity.toString(), slot0[1]);

    const amount0InWei = ethers.utils.parseUnits(amount0DesiredStr, token0Decimals);

    const position = Position.fromAmount0({
      pool: pool,
      tickLower: tickLower,
      tickUpper: tickUpper,
      amount0: amount0InWei.toBigInt(),
      useFullPrecision: true,
    });

    const amount1DesiredBI = position.amount1.quotient;

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

    ui.updateLiveData(`
        <h3>Calculation Results:</h3>
        <p><strong>Token 0 (${token0Symbol}) Balance:</strong> ${ethers.utils.formatUnits(token0Balance, token0Decimals)}</p>
        <p><strong>Token 1 (${token1Symbol}) Balance:</strong> ${ethers.utils.formatUnits(token1Balance, token1Decimals)}</p>
        <hr>
        <p><strong>Current Pool Tick:</strong> ${currentTick}</p>
        <p><strong>Input Amount (${token0Symbol}):</strong> ${amount0DesiredStr}</p>
        <p><strong>Calculated Amount (${token1Symbol}):</strong> ${amount1Display}</p>
      `);

    document.getElementById('addLiquidityBtn').disabled = false;

    try {
      const response = await fetch(
        `https://explorer.pancakeswap.com/api/cached/pools/v3/bsc/${poolAddress.toLowerCase()}`
      );
      const data = await response.json();
      if (data && data.tvlUSD) {
        const formatCurrency = (value) =>
          `$${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const fees24h = parseFloat(data.feeUSD24h);
        const tvl = parseFloat(data.tvlUSD);
        let apr = 0;
        if (tvl > 0 && fees24h > 0) {
          apr = (fees24h / tvl) * 365 * 100;
        }
        ui.updatePoolStats({
          tvlUSD: formatCurrency(data.tvlUSD),
          volumeUSD: formatCurrency(data.volumeUSD24h),
          feesUSD: formatCurrency(data.feeUSD24h),
          apr: apr.toFixed(2),
        });
      } else {
        ui.updatePoolStats(null);
      }
    } catch (error) {
      console.error('Error fetching pool stats:', error);
      ui.updatePoolStats(null);
    }
  } catch (error) {
    console.error('Calculation failed:', error);
    ui.updateLiveData(`<p style="color:red;">Error: ${error.message}</p>`);
  }
}

async function approveTokenIfNeeded(tokenAddress, amount) {
  if (BigInt(amount.toString()) === 0n) {
    return;
  }

  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const allowance = await tokenContract.allowance(await signer.getAddress(), NONFUNGIBLE_POSITION_MANAGER_ADDRESS);
  const tokenSymbol = await tokenContract.symbol();

  if (allowance.lt(amount)) {
    ui.updateTxStatus(`Requesting approval for ${tokenSymbol}...`);
    const approveTx = await tokenContract.approve(NONFUNGIBLE_POSITION_MANAGER_ADDRESS, ethers.constants.MaxUint256);
    ui.updateTxStatus(`Waiting for ${tokenSymbol} approval confirmation...`);
    await approveTx.wait();
    ui.updateTxStatus(`${tokenSymbol} approved!`);
  } else {
    console.log(`Approval for token ${tokenSymbol} is sufficient.`);
  }
}

export async function submitTransaction(event) {
  event.preventDefault();
  if (Object.keys(calculatedData).length === 0) {
    return alert('Please fetch and calculate the data first.');
  }

  ui.updateTxStatus('Validating transaction...');
  ui.hideTxLink();

  try {
    if (calculatedData.amount0Desired.gt(calculatedData.token0Balance)) {
      const required = ethers.utils.formatUnits(calculatedData.amount0Desired, calculatedData.token0Decimals);
      const balance = ethers.utils.formatUnits(calculatedData.token0Balance, calculatedData.token0Decimals);
      const message = `Insufficient ${calculatedData.token0Symbol} balance. Required: ${required}, Balance: ${balance}.`;
      ui.updateTxStatus('Error: Insufficient balance.');
      return alert(message);
    }
    if (calculatedData.amount1Desired.gt(calculatedData.token1Balance)) {
      const required = ethers.utils.formatUnits(calculatedData.amount1Desired, calculatedData.token1Decimals);
      const balance = ethers.utils.formatUnits(calculatedData.token1Balance, calculatedData.token1Decimals);
      const message = `Insufficient ${calculatedData.token1Symbol} balance. Required: ${required}, Balance: ${balance}.`;
      ui.updateTxStatus('Error: Insufficient balance.');
      return alert(message);
    }

    ui.updateTxStatus('Checking token approvals...');
    await approveTokenIfNeeded(calculatedData.token0, calculatedData.amount0Desired);
    await approveTokenIfNeeded(calculatedData.token1, calculatedData.amount1Desired);

    ui.updateTxStatus('Approvals confirmed. Preparing mint transaction...');

    const nfpmContract = new ethers.Contract(NONFUNGIBLE_POSITION_MANAGER_ADDRESS, NFPM_ABI, signer);

    const mintParams = {
      token0: calculatedData.token0,
      token1: calculatedData.token1,
      fee: calculatedData.fee,
      tickLower: calculatedData.tickLower,
      tickUpper: calculatedData.tickUpper,
      amount0Desired: calculatedData.amount0Desired,
      amount1Desired: calculatedData.amount1Desired,
      amount0Min: 0,
      amount1Min: 0,
      recipient: calculatedData.recipient,
      deadline: calculatedData.deadline,
    };

    ui.updateTxStatus('Please confirm the transaction in your wallet.');
    const txResponse = await nfpmContract.mint(mintParams);
    ui.updateTxStatus(`Transaction sent! Hash: ${txResponse.hash}. Waiting for confirmation...`);
    const receipt = await txResponse.wait();
    ui.updateTxStatus(`Transaction confirmed in block ${receipt.blockNumber}!`);
    ui.showTxLink(receipt.transactionHash);
  } catch (error) {
    console.error('Transaction failed:', error);
    ui.updateTxStatus(`Error: ${error.message}`);
  }
}

export async function fetchPositions() {
  if (!signer) return alert('Please connect your wallet first.');

  ui.updatePositionsList('Fetching positions...');

  try {
    const account = await signer.getAddress();
    const nfpmContract = new ethers.Contract(NONFUNGIBLE_POSITION_MANAGER_ADDRESS, NFPM_ABI, provider);
    const balance = await nfpmContract.balanceOf(account);

    if (balance.isZero()) {
      ui.renderPositions([]);
      return;
    }

    ui.updatePositionsList(''); // Clear 'Fetching...'

    const positionPromises = [];
    for (let i = 0; i < balance.toNumber(); i++) {
      positionPromises.push(nfpmContract.tokenOfOwnerByIndex(account, i));
    }

    const tokenIds = await Promise.all(positionPromises);
    const MAX_UINT128 = ethers.BigNumber.from(2).pow(128).sub(1);

    const factoryContract = new ethers.Contract(
      PANCAKE_V3_FACTORY_ADDRESS,
      ['function getPool(address,address,uint24) view returns (address)'],
      provider
    );

    const positionsData = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const positionInfo = await nfpmContract.positions(tokenId);

        if (positionInfo.liquidity.isZero()) return null;

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

        const collectParams = { tokenId, recipient: account, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 };
        const fees = await nfpmContract.callStatic.collect(collectParams, { from: account });

        const poolAddress = await factoryContract.getPool(token0.address, token1.address, positionInfo.fee);
        if (poolAddress === ethers.constants.AddressZero) return null;

        const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);
        const [slot0, poolLiquidity] = await Promise.all([poolContract.slot0(), poolContract.liquidity()]);

        const pool = new Pool(
          token0,
          token1,
          positionInfo.fee,
          slot0[0].toString(),
          poolLiquidity.toString(),
          slot0[1]
        );

        const position = new Position({
          pool,
          liquidity: positionInfo.liquidity.toString(),
          tickLower: positionInfo.tickLower,
          tickUpper: positionInfo.tickUpper,
        });

        let price0Usd = null,
          price1Usd = null;
        if (token0.address.toLowerCase() === USDT_ADDRESS.toLowerCase()) {
          price0Usd = 1;
          price1Usd = parseFloat(pool.token1Price.toSignificant(18));
        } else if (token1.address.toLowerCase() === USDT_ADDRESS.toLowerCase()) {
          price1Usd = 1;
          price0Usd = parseFloat(pool.token0Price.toSignificant(18));
        }

        const feeAmount0 = ethers.utils.formatUnits(fees.amount0, token0.decimals);
        const feeAmount1 = ethers.utils.formatUnits(fees.amount1, token1.decimals);
        let estimatedFeeValue = null;
        if (price0Usd !== null && price1Usd !== null) {
          estimatedFeeValue = parseFloat(feeAmount0) * price0Usd + parseFloat(feeAmount1) * price1Usd;
        }

        return {
          tokenId: tokenId.toString(),
          token0Symbol,
          token1Symbol,
          fee: positionInfo.fee,
          tickLower: positionInfo.tickLower,
          tickUpper: positionInfo.tickUpper,
          liquidity: positionInfo.liquidity.toString(),
          amount0: ethers.utils.formatUnits(position.amount0.quotient.toString(), token0.decimals),
          amount1: ethers.utils.formatUnits(position.amount1.quotient.toString(), token1.decimals),
          feeAmount0,
          feeAmount1,
          estimatedFeeValue,
        };
      })
    );

    ui.renderPositions(positionsData.filter((p) => p !== null));
  } catch (error) {
    console.error('Failed to fetch positions:', error);
    ui.updatePositionsList(`<p style="color:red;">Error fetching positions: ${error.message}</p>`);
  }
}

export async function claimFees(tokenId) {
  const statusEl = document.querySelector(`#position-${tokenId} .claim-status`);
  const claimBtn = document.querySelector(`.claim-btn[data-tokenid='${tokenId}']`);
  if (!statusEl || !claimBtn) return console.error(`UI elements not found for token ${tokenId}`);

  statusEl.textContent = 'Preparing to claim...';
  claimBtn.disabled = true;

  try {
    const account = await signer.getAddress();
    const nfpmContract = new ethers.Contract(NONFUNGIBLE_POSITION_MANAGER_ADDRESS, NFPM_ABI, signer);
    const MAX_UINT128 = ethers.BigNumber.from(2).pow(128).sub(1);

    const collectParams = { tokenId, recipient: account, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 };

    statusEl.textContent = 'Please confirm the transaction in your wallet...';
    const tx = await nfpmContract.collect(collectParams);
    statusEl.innerHTML = `Claim Tx: <a href="https://bscscan.com/tx/${tx.hash}" target="_blank">${tx.hash.substring(0, 10)}...</a><br>Waiting...`;

    await tx.wait();
    statusEl.textContent = `Fees claimed successfully!`;

    setTimeout(fetchPositions, 2000); // Refresh positions list
  } catch (error) {
    console.error('Failed to claim fees:', error);
    statusEl.textContent = `Error: ${error.message}`;
    setTimeout(() => {
      statusEl.textContent = '';
      claimBtn.disabled = false;
    }, 5000);
  }
}

export async function removeLiquidity(tokenId) {
  const statusEl = document.querySelector(`#remove-section-${tokenId} .remove-status`);
  const confirmBtn = document.querySelector(`.confirm-remove-btn[data-tokenid='${tokenId}']`);
  const percentageInput = document.getElementById(`remove-percentage-${tokenId}`);
  if (!statusEl || !confirmBtn || !percentageInput)
    return console.error(`UI elements for remove liquidity not found for token ${tokenId}`);

  const percentage = percentageInput.value;
  if (!percentage || percentage <= 0 || percentage > 100) {
    statusEl.textContent = 'Please enter a valid percentage (1-100).';
    return;
  }

  statusEl.textContent = 'Preparing to remove liquidity...';
  confirmBtn.disabled = true;
  percentageInput.disabled = true;

  try {
    const totalLiquidity = ethers.BigNumber.from(confirmBtn.dataset.liquidity);
    const liquidityToRemove = totalLiquidity.mul(percentage).div(100);

    const nfpmContract = new ethers.Contract(NONFUNGIBLE_POSITION_MANAGER_ADDRESS, NFPM_ABI, signer);

    const decreaseParams = {
      tokenId,
      liquidity: liquidityToRemove,
      amount0Min: 0,
      amount1Min: 0,
      deadline: Math.floor(Date.now() / 1000) + 60 * 20,
    };

    statusEl.textContent = 'Decreasing liquidity... Please confirm in your wallet.';
    const decreaseTx = await nfpmContract.decreaseLiquidity(decreaseParams);
    statusEl.innerHTML = `Decrease Tx: <a href="https://bscscan.com/tx/${decreaseTx.hash}" target="_blank">${decreaseTx.hash.substring(0, 10)}...</a> Waiting...`;
    await decreaseTx.wait();

    statusEl.textContent = 'Liquidity decreased. Now collecting tokens...';
    const MAX_UINT128 = ethers.BigNumber.from(2).pow(128).sub(1);
    const account = await signer.getAddress();
    const collectParams = { tokenId, recipient: account, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 };

    statusEl.textContent = 'Collecting tokens... Please confirm in your wallet.';
    const collectTx = await nfpmContract.collect(collectParams);
    statusEl.innerHTML = `Collect Tx: <a href="https://bscscan.com/tx/${collectTx.hash}" target="_blank">${collectTx.hash.substring(0, 10)}...</a> Waiting...`;
    await collectTx.wait();

    statusEl.textContent = 'Liquidity successfully removed!';
    setTimeout(fetchPositions, 2000); // Refresh positions list
  } catch (error) {
    console.error('Failed to remove liquidity:', error);
    statusEl.textContent = `Error: ${error.message}`;
    setTimeout(() => {
      statusEl.textContent = '';
      confirmBtn.disabled = false;
      percentageInput.disabled = false;
    }, 5000);
  }
}
