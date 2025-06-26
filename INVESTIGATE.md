# INVESTIGATE

tx: https://bscscan.com/tx/0x12e9400d1fab45d42993889bb0ae6e20ed53ba42fc86e5242423f432d1be3fcc

Raw Tx data

```
0x8831645600000000000000000000000055d398326f99059ff775485246999027b3197955000000000000000000000000ff7d6a96ae471bbcd7713af9cb1feeb16cf56b41000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000076cf00000000000000000000000000000000000000000000000000000000000076d1000000000000000000000000000000000000000000000000faa44dc8086c45f500000000000000000000000000000000000000000000001c5edd684e3d6c8ede0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000082944b68bb92fa11764041aa61204b5fdc85f429000000000000000000000000000000000000000000000000000000006853b119
```

The data from bscscan.

```
Function: mint(tuple params)

MethodID: 0x88316456
[0]:  00000000000000000000000055d398326f99059ff775485246999027b3197955
[1]:  000000000000000000000000ff7d6a96ae471bbcd7713af9cb1feeb16cf56b41
[2]:  0000000000000000000000000000000000000000000000000000000000000064
[3]:  00000000000000000000000000000000000000000000000000000000000076cf
[4]:  00000000000000000000000000000000000000000000000000000000000076d1
[5]:  000000000000000000000000000000000000000000000000faa44dc8086c45f5
[6]:  00000000000000000000000000000000000000000000001c5edd684e3d6c8ede
[7]:  0000000000000000000000000000000000000000000000000000000000000000
[8]:  0000000000000000000000000000000000000000000000000000000000000000
[9]:  00000000000000000000000082944b68bb92fa11764041aa61204b5fdc85f429
[10]: 000000000000000000000000000000000000000000000000000000006853b119
```

Decoded Data

```
Function: mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))
#	Name	Type	Data
0	params.token0	address 0x55d398326f99059fF775485246999027B3197955
0	params.token1	address 0xFf7d6A96ae471BbCD7713aF9CB1fEeB16cf56B41
0	params.fee	uint24 100
0	params.tickLower	int24 30415
0	params.tickUpper	int24 30417
0	params.amount0Desired	uint256 18060645927192643061
0	params.amount1Desired	uint256 523344568558532988638
0	params.amount0Min	uint256 0
0	params.amount1Min	uint256 0
0	params.recipient	address 0x82944b68bB92fA11764041AA61204b5fdC85F429
0	params.deadline	uint256 1750315289
```

I have added liquidity to pancake swap, the Raw Tx data and Decoded Data are as above.

The token0 is USDT, token1 is BR.

USDT address is 0x55d398326f99059fF775485246999027B3197955
BR address is 0xFf7d6A96ae471BbCD7713aF9CB1fEeB16cf56B41

When I add the liquidity, the min price is 20.9334 BR per USDT, max price is 20.9376 BR per USDT.

The tickLower is 30415
The tickUpper is 30417

The amount0Desired of USDT is 18060645927192643061
The amount1Desired of BR is 523344568558532988638

the amount0Desired and amount1Desired from the price range as above. The price range is 20.9334 BR per USDT to 20.9376 BR per USDT.

So before encoding the parameters, I need to calculate the amount0Desired and amount1Desired from the price range as above.

The contract is a Pancake V3 pool, and address is 0x46A15B0b27311cedF172AB29E4f4766fbE7F4364

The following human readable data will be provided, token0 address, token1 address, fee, tickLower, tickUpper, receipient, the price range and deadline.

All I need is a nodejs script to encode human readable data to raw data.

Before you build the script, please make sure:

1. check the log file after npm install to make sure npm install success.
2. check the package.json to make sure the dependencies are correct.
3. try to decode the raw data provide as above to figure out how the raw data is encoded.
4. make sure amount0Desired and amount1Desired are calculated from price range correct.
5. add test for the script by using the example raw data, the example data from bscscan and the example price range.

The files, calculateAmounts.js and encodeMintParams.js, are previous version, not verified yet.

When you have the solution, please begin the work.

---

https://explorer.pancakeswap.com/api/cached/tokens/v3/bsc/0xff7d6a96ae471bbcd7713af9cb1feeb16cf56b41

https://explorer.pancakeswap.com/api/cached/pools/v3/bsc/list/top?token=0xff7d6a96ae471bbcd7713af9cb1feeb16cf56b41

https://explorer.pancakeswap.com/api/cached/pools/v3/bsc/0x380aadf63d84d3a434073f1d5d95f02fb23d5228
