const { ethers } = require('ethers');
const { Token } = require('@pancakeswap/swap-sdk-core');
const { Pool, Position } = require('@pancakeswap/v3-sdk');

// --- ABIs for contract interaction ---
const ERC20_ABI = ['function decimals() view returns (uint8)', 'function symbol() view returns (string)'];

const PANCAKE_V3_POOL_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
];

const CHAIN_ID = 56; // BNB Smart Chain
const RPC_URL = 'https://bsc-dataseed.defibit.io/';
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

async function generateMintData() {
  console.log('--- Starting Calldata Generation with Live On-Chain Data ---\n');

  // --- 1. User-Provided Inputs ---
  const mintConfig = {
    poolAddress: '0x380aaDF63D84D3A434073F1d5d95f02fB23d5228', // Verified USDT/BR Pool
    tickLower: 30415,
    tickUpper: 30417,
    // The amount of token0 (USDT) you want to provide.
    // The script will calculate the required amount of token1 (BR).
    amount0Desired: 18060645927192643061n,
    recipient: '0x82944b68bB92fA11764041AA61204b5fdC85F429',
    deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from now
  };

  try {
    // --- 2. Fetch Live Data from Verified Pool ---
    console.log(`--- Fetching data from pool: ${mintConfig.poolAddress} ---`);
    const poolContract = new ethers.Contract(mintConfig.poolAddress, PANCAKE_V3_POOL_ABI, provider);

    const [token0Addr, token1Addr, fee, slot0, liquidity] = await Promise.all([
      poolContract.token0(),
      poolContract.token1(),
      poolContract.fee(),
      poolContract.slot0(),
      poolContract.liquidity(),
    ]);

    const token0Contract = new ethers.Contract(token0Addr, ERC20_ABI, provider);
    const token1Contract = new ethers.Contract(token1Addr, ERC20_ABI, provider);

    const [token0Decimals, token1Decimals, token0Symbol, token1Symbol] = await Promise.all([
      token0Contract.decimals(),
      token1Contract.decimals(),
      token0Contract.symbol(),
      token1Contract.symbol(),
    ]);

    console.log(`Pool Fee: ${fee}`);
    console.log(`Token0: ${token0Symbol} (${token0Addr})`);
    console.log(`Token1: ${token1Symbol} (${token1Addr})`);
    console.log('----------------------------------------------------\n');

    // --- 3. Use SDK to Calculate Dependent Amount ---
    const TOKEN0 = new Token(CHAIN_ID, token0Addr, token0Decimals, token0Symbol);
    const TOKEN1 = new Token(CHAIN_ID, token1Addr, token1Decimals, token1Symbol);

    const { sqrtPriceX96, tick } = slot0;
    const pool = new Pool(TOKEN0, TOKEN1, fee, sqrtPriceX96, liquidity, tick);

    const position = Position.fromAmount0({
      pool: pool,
      tickLower: mintConfig.tickLower,
      tickUpper: mintConfig.tickUpper,
      amount0: mintConfig.amount0Desired,
      useFullPrecision: true,
    });

    const amount1Desired = position.amount1.quotient;
    console.log(`--- Calculation Results ---`);
    console.log(`Input Amount (${TOKEN0.symbol}): ${mintConfig.amount0Desired.toString()}`);
    console.log(`Calculated Amount (${TOKEN1.symbol}): ${amount1Desired.toString()}`);
    console.log('---------------------------\n');

    // --- 4. Construct and Encode Calldata ---
    const mintParams = {
      token0: token0Addr,
      token1: token1Addr,
      fee: fee,
      tickLower: mintConfig.tickLower,
      tickUpper: mintConfig.tickUpper,
      amount0Desired: mintConfig.amount0Desired,
      amount1Desired: amount1Desired,
      amount0Min: 0n, // Note: For production, set a real slippage value
      amount1Min: 0n, // Note: For production, set a real slippage value
      recipient: mintConfig.recipient,
      deadline: mintConfig.deadline,
    };

    const MINT_SELECTOR = '0x88316456';
    const abiCoder = new ethers.utils.AbiCoder();
    const encodedParams = abiCoder.encode(
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
      Object.values(mintParams)
    );

    const calldata = MINT_SELECTOR + encodedParams.substring(2);

    console.log('--- Final Generated Calldata ---');
    console.log(calldata);
    console.log('----------------------------------\n');

    return calldata;
  } catch (error) {
    console.error('\n--- SCRIPT FAILED ---');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
generateMintData();
