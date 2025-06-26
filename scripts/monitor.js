require('dotenv').config();
const { ethers } = require('ethers');
const TelegramMessenger = require('./telegram');

const { RPC_URL, WALLET_ADDRESS, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

// --- ABIs ---
const NFPM_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint256 tokensOwed0, uint256 tokensOwed1)',
];

const POOL_ABI = [
  'function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
];

const ERC20_ABI = ['function symbol() view returns (string)'];

const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364';
const PANCAKE_V3_FACTORY_ADDRESS = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865';

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const nfpmContract = new ethers.Contract(NONFUNGIBLE_POSITION_MANAGER_ADDRESS, NFPM_ABI, provider);
const telegram = new TelegramMessenger(TELEGRAM_BOT_TOKEN);

async function sendTgMessage(message, lvl) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;
  console.log(logEntry);

  const icon = lvl === 'error' ? '🚨' : '⚠️';
  const title = lvl === 'error' ? 'Service Error' : 'Service Warning';
  const serviceName = 'Pancake LP Monitor';
  const content =
    `${icon} [${serviceName}] ${title}\n\n` +
    `Service: ${serviceName}\n` +
    `Content:\n` +
    `${message}\n\n` +
    `Time: ${new Date().toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' })} UTC+8`;

  if (lvl == 'error') {
    telegram.sendMessage(TELEGRAM_CHAT_ID, content);
  } else if (lvl == 'warn') {
    telegram.sendMessage(TELEGRAM_CHAT_ID, content);
  }
}

async function main() {
  console.log('Starting monitor script...');
  if (!RPC_URL || !WALLET_ADDRESS || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Please set all required environment variables.');
    process.exit(1);
  }
  console.log('Environment variables loaded.');

  try {
    console.log('Fetching position balance...');
    const balance = await nfpmContract.balanceOf(WALLET_ADDRESS);
    console.log(`Balance fetched: ${balance.toString()}`);

    if (balance.eq(0)) {
      console.log('No positions found.');
      return;
    }

    console.log(`Found ${balance.toString()} positions. Checking status...`);

    const outOfRangePositions = [];

    for (let i = 0; i < balance; i++) {
      console.log(`--- Checking position ${i + 1} ---`);
      console.log('Fetching token ID...');
      const tokenId = await nfpmContract.tokenOfOwnerByIndex(WALLET_ADDRESS, i);
      console.log(`Token ID: ${tokenId.toString()}`);

      console.log('Fetching position info...');
      const positionInfo = await nfpmContract.positions(tokenId);
      console.log('Position info fetched.');

      if (positionInfo.liquidity.eq(0)) {
        console.log('Position has zero liquidity. Skipping.');
        continue;
      }

      console.log('Fetching pool address...');
      const poolAddress = await new ethers.Contract(
        PANCAKE_V3_FACTORY_ADDRESS,
        ['function getPool(address, address, uint24) view returns (address)'],
        provider
      ).getPool(positionInfo.token0, positionInfo.token1, positionInfo.fee);
      console.log(`Pool address: ${poolAddress}`);

      const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);
      console.log('Fetching pool slot0...');
      const slot0 = await poolContract.slot0();
      const currentTick = slot0[1];
      console.log(`Current tick: ${currentTick}`);

      if (currentTick < positionInfo.tickLower || currentTick >= positionInfo.tickUpper) {
        console.log('Position is out of range. Fetching token symbols...');
        const token0Contract = new ethers.Contract(positionInfo.token0, ERC20_ABI, provider);
        const token1Contract = new ethers.Contract(positionInfo.token1, ERC20_ABI, provider);

        console.log('Fetching symbol for token 0...');
        const token0Symbol = await token0Contract.symbol();
        console.log(`Token 0 symbol: ${token0Symbol}`);

        console.log('Fetching symbol for token 1...');
        const token1Symbol = await token1Contract.symbol();
        console.log(`Token 1 symbol: ${token1Symbol}`);

        outOfRangePositions.push(
          `<b>Position Out of Range</b>:\n` +
            `  - Pair: ${token0Symbol}/${token1Symbol}\n` +
            `  - Token ID: ${tokenId.toString()}\n` +
            `  - Range: ${positionInfo.tickLower} to ${positionInfo.tickUpper}\n` +
            `  - Current Tick: ${currentTick}`
        );
      } else {
        console.log('Position is in range.');
      }
    }

    if (outOfRangePositions.length > 0) {
      console.log('Sending Telegram notification...');
      await sendTgMessage(outOfRangePositions, 'warn');
      console.log('Notification sent for out-of-range positions.');
    } else {
      console.log('All positions are in range. No notification needed.');
    }
  } catch (error) {
    console.error('An error occurred:', error);
    try {
      await sendTgMessage(`An error occurred while monitoring your positions: ${error.message}`, 'error');
    } catch (telegramError) {
      console.error('Failed to send error message via Telegram:', telegramError);
    }
  }
}

main();
