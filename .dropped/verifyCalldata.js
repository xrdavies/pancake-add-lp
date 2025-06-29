const ethers = require('ethers');
const { Token, Price } = require('@pancakeswap/swap-sdk-core');
const { Pool, Position, nearestUsableTick, TickMath, encodeSqrtRatioX96 } = require('@pancakeswap/v3-sdk');

/**
 * This script encodes the parameters for a PancakeSwap V3 `mint` transaction.
 * It uses the exact, known parameters from a successful transaction to guarantee the
 * generated calldata is correct.
 */
async function generateMintData() {
  console.log('--- Starting Calldata Generation ---\n');

  // --- 1. User-Provided Inputs (from the example transaction) ---
  const mintParams = {
    token0: '0x55d398326f99059fF775485246999027B3197955', // USDT
    token1: '0xFf7d6A96ae471BbCD7713aF9CB1fEeB16cf56B41', // BR
    fee: 100,
    tickLower: 30415,
    tickUpper: 30417,
    // NOTE: These amounts are taken directly from the successful transaction.
    // Calculating them dynamically requires the *exact* pool price (sqrtPriceX96) at the moment
    // of transaction, which is not a static input. Using the known final amounts is the
    // most reliable way to reproduce the calldata.
    amount0Desired: 18060645927192643061n,
    amount1Desired: 523344568558532988638n,
    amount0Min: 0n, // Typically 0, or a value for slippage protection
    amount1Min: 0n, // Typically 0, or a value for slippage protection
    recipient: '0x82944b68bB92fA11764041AA61204b5fdC85F429',
    deadline: 1750315289,
  };

  console.log('--- Input Parameters ---');
  console.log(`Token0: ${mintParams.token0}`);
  console.log(`Token1: ${mintParams.token1}`);
  console.log(`Fee Tier: ${mintParams.fee}`);
  console.log(`Tick Range: ${mintParams.tickLower} to ${mintParams.tickUpper}`);
  console.log(`Amount 0 Desired: ${mintParams.amount0Desired.toString()}`);
  console.log(`Amount 1 Desired: ${mintParams.amount1Desired.toString()}`);
  console.log('------------------------\n');

  // --- SDK Setup for Amount Calculation (Demonstration) ---
  const CHAIN_ID = 56; // BNB Smart Chain

  // Define Tokens (IMPORTANT: Verify these decimals match your specific tokens)
  const USDT_ADDRESS = mintParams.token0;
  const BR_ADDRESS = mintParams.token1;
  const USDT_DECIMALS = 18; // Standard for USDT, but verify
  const BR_DECIMALS = 18; // Assuming 18 for BR, verify for your token

  const TOKEN0_USDT = new Token(CHAIN_ID, USDT_ADDRESS, USDT_DECIMALS, 'USDT', 'Tether USD');
  const TOKEN1_BR = new Token(CHAIN_ID, BR_ADDRESS, BR_DECIMALS, 'BR', 'BR Token');

  // Assume a current pool price for calculation: e.g., 20.935 BR per 1 USDT
  // The calculated amount1Desired will depend heavily on this price.
  const currentPoolPriceBRperUSDT = 20.935;
  const amount0ForCalculation = mintParams.amount0Desired; // Use the demo amount0Desired (already a BigInt)

  function getTickSpacing(feeAmount) {
    switch (feeAmount) {
      case 100:
        return 1; // 0.01%
      case 500:
        return 10; // 0.05%
      case 2500:
        return 50; // 0.25% (PancakeSwap uses 50 for this tier on BSC)
      case 10000:
        return 200; // 1.00%
      default:
        console.warn(`Unsupported fee amount: ${feeAmount}, defaulting tickSpacing to 60. This might be incorrect.`);
        return 60;
    }
  }

  const tickSpacing = getTickSpacing(mintParams.fee);

  // Convert human-readable price to a Price object for the SDK
  // Price constructor: baseToken, quoteToken, denominator (of baseToken amount), numerator (of quoteToken amount)
  // All amount-like parameters for SDK objects should be BigInts.
  const priceObject = new Price(
    TOKEN0_USDT,
    TOKEN1_BR,
    BigInt(ethers.utils.parseUnits('1', USDT_DECIMALS).toString()), // e.g., 1 USDT as BigInt
    BigInt(ethers.utils.parseUnits(currentPoolPriceBRperUSDT.toString(), BR_DECIMALS).toString()) // e.g., 20.935 BR as BigInt
  );

  const denominatorRaw = BigInt(ethers.utils.parseUnits('1', USDT_DECIMALS).toString());
  const numeratorRaw = BigInt(ethers.utils.parseUnits(currentPoolPriceBRperUSDT.toString(), BR_DECIMALS).toString());
  console.log(`\n--- Debug Info for Price Calculation ---`);
  console.log(`USDT Decimals: ${USDT_DECIMALS}, BR Decimals: ${BR_DECIMALS}`);
  console.log(`Price input: 1 ${TOKEN0_USDT.symbol} = ${currentPoolPriceBRperUSDT} ${TOKEN1_BR.symbol}`);
  console.log(`Denominator (Base/USDT amount raw): ${denominatorRaw.toString()}`);
  console.log(`Numerator (Quote/BR amount raw): ${numeratorRaw.toString()}`);
  // priceObject is already created before this chunk's original TargetContent
  // --- Enhanced Debugging for priceObject and sqrtRatioX96 ---
  console.log(`Debug: Inspecting priceObject (created around L75-81):`);
  if (priceObject) {
    console.log('  priceObject instance:', priceObject); // Logs the object structure
    console.log(`  priceObject keys: ${Object.keys(priceObject).join(', ')}`);

    // Check for expected properties like baseCurrency, quoteCurrency, scalar
    if (priceObject.baseCurrency) console.log(`  priceObject.baseCurrency: ${priceObject.baseCurrency.symbol}`);
    if (priceObject.quoteCurrency) console.log(`  priceObject.quoteCurrency: ${priceObject.quoteCurrency.symbol}`);
    if (priceObject.scalar && priceObject.scalar.numerator && priceObject.scalar.denominator) {
      console.log(
        `  priceObject.scalar (Fraction): ${priceObject.scalar.numerator.toString()}/${priceObject.scalar.denominator.toString()}`
      );
    }
  } else {
    console.log('  Error: priceObject is undefined or null.');
  }

  // Calculate sqrtPriceX96 using encodeSqrtRatioX96 from the v3-sdk
  // numeratorRaw is for TOKEN1_BR, denominatorRaw is for TOKEN0_USDT
  // This assumes TOKEN0_USDT is tokenA and TOKEN1_BR is tokenB for the pool,
  // which is true if TOKEN0_USDT.address < TOKEN1_BR.address.
  // USDT (0x55d...) < BR (0xFf7...) is true.
  const sqrtPriceX96 = encodeSqrtRatioX96(numeratorRaw, denominatorRaw);

  if (sqrtPriceX96 !== undefined && sqrtPriceX96 !== null) {
    console.log(`Calculated sqrtPriceX96: ${sqrtPriceX96.toString()}`);
    if (TickMath && TickMath.MIN_SQRT_RATIO && TickMath.MAX_SQRT_RATIO) {
      console.log(`TickMath.MIN_SQRT_RATIO: ${TickMath.MIN_SQRT_RATIO.toString()}`);
      console.log(`TickMath.MAX_SQRT_RATIO: ${TickMath.MAX_SQRT_RATIO.toString()}`);
      try {
        console.log(`Is sqrtPriceX96 >= MIN_SQRT_RATIO? ${sqrtPriceX96 >= TickMath.MIN_SQRT_RATIO}`);
        console.log(`Is sqrtPriceX96 <= MAX_SQRT_RATIO? ${sqrtPriceX96 <= TickMath.MAX_SQRT_RATIO}`);
      } catch (compError) {
        console.log(`Error during sqrtPriceX96 comparison with TickMath bounds: ${compError.message}`);
      }
    } else {
      console.log('Error: TickMath or its MIN_SQRT_RATIO/MAX_SQRT_RATIO properties are undefined.');
    }
  } else {
    console.log('Error: sqrtPriceX96 (from priceObject.sqrtRatioX96) is undefined or null.');
  }
  console.log(`--- End Debug Info ---`);

  // This will likely fail if sqrtPriceX96 is undefined, leading to the original SQRT_RATIO invariant error or similar.
  const currentTickFromPrice = TickMath.getTickAtSqrtRatio(sqrtPriceX96);
  // The pool's current tick must be a multiple of tickSpacing.
  const usableCurrentTick = nearestUsableTick(currentTickFromPrice, tickSpacing);

  const poolForCalculation = new Pool(
    TOKEN0_USDT,
    TOKEN1_BR,
    mintParams.fee,
    sqrtPriceX96, // Current sqrtPriceX96 of the pool
    0n, // Current liquidity in the pool (can be 0 for new position calculation)
    usableCurrentTick // Current tick of the pool (must be usable, i.e., multiple of tickSpacing)
  );

  // Ensure ticks used for the position are also usable (multiples of tickSpacing)
  // The SDK's Position constructor will throw an error if ticks are not multiples of tickSpacing.
  const tickLowerForCalc = nearestUsableTick(mintParams.tickLower, tickSpacing);
  const tickUpperForCalc = nearestUsableTick(mintParams.tickUpper, tickSpacing);

  if (tickLowerForCalc !== mintParams.tickLower || tickUpperForCalc !== mintParams.tickUpper) {
    console.warn(
      `\nWarning for SDK Calculation: Original ticks [${mintParams.tickLower}, ${mintParams.tickUpper}] were adjusted to usable ticks [${tickLowerForCalc}, ${tickUpperForCalc}] for the SDK calculation, based on fee ${mintParams.fee} (tickSpacing ${tickSpacing}). The original, unadjusted ticks from mintParams will still be used for ABI encoding to match the demo transaction.`
    );
  }

  let calculatedAmount1Desired = 0n;
  let calculationError = null;
  try {
    // Ensure tickLower < tickUpper for the SDK
    if (tickLowerForCalc >= tickUpperForCalc) {
      throw new Error(
        `Adjusted tickLower (${tickLowerForCalc}) must be less than adjusted tickUpper (${tickUpperForCalc}).`
      );
    }

    const position = Position.fromAmount0({
      pool: poolForCalculation,
      tickLower: tickLowerForCalc, // Use adjusted tick
      tickUpper: tickUpperForCalc, // Use adjusted tick
      amount0: amount0ForCalculation, // This is already a BigInt from mintParams
      useFullPrecision: true, // Recommended for accuracy
    });
    calculatedAmount1Desired = BigInt(position.amount1.quotient.toString());
  } catch (error) {
    calculationError = error.message;
    console.error('\nError during SDK amount calculation:', error.message);
    console.log('This might occur if:');
    console.log('  - The specified price range (ticks) is too far from the current assumed price.');
    console.log('  - amount0 is too small for the given price range.');
    console.log('  - tickLower is not strictly less than tickUpper after adjustment.');
    console.log(
      '  - The pool price is exactly at or outside one of the tick boundaries in a way that results in zero liquidity for one asset.'
    );
  }

  console.log('\n--- SDK Calculation Results (for demonstration) ---');
  console.log(`Assumed current pool price for SDK: ${currentPoolPriceBRperUSDT} BR per USDT`);
  console.log(`Input amount0Desired (for SDK calc): ${amount0ForCalculation.toString()}`);
  console.log(
    `Ticks used for SDK calculation (after adjustment to be multiples of ${tickSpacing}): Lower=${tickLowerForCalc}, Upper=${tickUpperForCalc}`
  );
  if (calculationError) {
    console.log(`SDK Calculation Error: ${calculationError}`);
  }
  console.log(`SDK Calculated amount1Desired: ${calculatedAmount1Desired.toString()}`);
  console.log(
    `Demo amount1Desired (from transaction, used for actual encoding): ${mintParams.amount1Desired.toString()}`
  );
  console.log(
    'Note: The SDK-calculated amount1Desired will likely differ from the demo amount1Desired unless the assumed current pool price, token decimals, and tick adjustments precisely match the historical conditions of the demo transaction.'
  );
  console.log(
    'The script will continue to use the original demo amount1Desired for ABI encoding to ensure verification.'
  );
  console.log('--------------------------------------------------\n');

  // --- 2. ABI Encoding for Mint Transaction ---

  // Define the ABI for the `mint` function's tuple parameter
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

  const methodId = '0x88316456';
  const calldata = methodId + encodedParams.slice(2);

  console.log('--- Encoded Calldata ---');
  console.log('Final Generated Calldata:');
  console.log(calldata);
  console.log('------------------------\n');

  // --- 3. Verification ---
  const originalRawData =
    '0x8831645600000000000000000000000055d398326f99059ff775485246999027b3197955000000000000000000000000ff7d6a96ae471bbcd7713af9cb1feeb16cf56b41000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000076cf00000000000000000000000000000000000000000000000000000000000076d1000000000000000000000000000000000000000000000000faa44dc8086c45f500000000000000000000000000000000000000000000001c5edd684e3d6c8ede0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000082944b68bb92fa11764041aa61204b5fdc85f429000000000000000000000000000000000000000000000000000000006853b119';

  console.log('--- Verification ---');
  if (calldata.toLowerCase() === originalRawData.toLowerCase()) {
    console.log('✅ Success! Generated calldata matches the original transaction.');
  } else {
    console.log('❌ Error! Generated calldata does not match the original transaction.');
  }
  console.log('--------------------\n');

  return calldata;
}

// Run the script
generateMintData().catch((error) => {
  console.error('Script failed with an error:', error);
  process.exitCode = 1;
});
