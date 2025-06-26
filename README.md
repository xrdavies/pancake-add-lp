[English](#pancakeswap-v3-add-liquidity-tool) | [中文](#pancakeswap-v3-添加流动性工具)

**Live Demo**: [https://xrdavies.github.io/pancake-add-lp/](https://xrdavies.github.io/pancake-add-lp/)

---

# PancakeSwap V3 Add Liquidity Tool

This is a simple frontend utility for adding liquidity to a PancakeSwap V3 pool on the BNB Smart Chain. It allows users to connect their MetaMask wallet, fetch live on-chain data for a specific pool, and calculate the required token amounts to add liquidity within a specified price range (tick range).

## Core Features

- **Wallet Connection**: Connects to the user's MetaMask wallet.
- **Live Data Fetching**: Fetches real-time data from a PancakeSwap V3 pool, including token details, fee tier, and current tick.
- **Liquidity Calculation**: Uses the PancakeSwap V3 SDK to calculate the required amount of the second token based on the user's input for the first token and the desired tick range.
- **Balance & Approval Checks**: Automatically checks for sufficient token balances and handles ERC20 token approvals before submitting the transaction.
- **Transaction Submission**: Constructs and sends the `mint` transaction to the PancakeSwap V3 Nonfungible Position Manager contract.

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript
- **Web3 Libraries**: `ethers.js` (v5)
- **PancakeSwap SDK**: `@pancakeswap/v3-sdk`, `@pancakeswap/swap-sdk-core`
- **Build Tool**: Vite

## How to Run Locally

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/xrdavies/pancake-add-lp.git
    cd pancake-add-lp
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the development server:**
    ```bash
    npm run dev
    ```

4.  Open your browser and navigate to the local URL provided by Vite (usually `http://localhost:5173`).

---

# PancakeSwap V3 添加流动性工具

这是一个简单的前端实用工具，用于在 BNB 智能链上为 PancakeSwap V3 池添加流动性。它允许用户连接他们的 MetaMask 钱包，获取特定池的实时链上数据，并计算在指定价格范围（tick 范围）内添加流动性所需的代币数量。

## 核心功能

- **钱包连接**：连接到用户的 MetaMask 钱包。
- **实时数据获取**：从 PancakeSwap V3 池中获取实时数据，包括代币详情、费用等级和当前 tick。
- **流动性计算**：使用 PancakeSwap V3 SDK，根据用户输入的第一个代币数量和期望的 tick 范围，计算所需的第二个代币数量。
- **余额与授权检查**：在提交交易前，自动检查代币余额是否充足，并处理 ERC20 代币的授权。
- **交易提交**：构建并向 PancakeSwap V3 非同质化仓位管理器合约发送 `mint` 交易。

## 技术栈

- **前端**: HTML, CSS, JavaScript
- **Web3 库**: `ethers.js` (v5)
- **PancakeSwap SDK**: `@pancakeswap/v3-sdk`, `@pancakeswap/swap-sdk-core`
- **构建工具**: Vite

## 如何在本地运行

1.  **克隆仓库：**
    ```bash
    git clone https://github.com/xrdavies/pancake-add-lp.git
    cd pancake-add-lp
    ```

2.  **安装依赖：**
    ```bash
    npm install
    ```

3.  **启动开发服务器：**
    ```bash
    npm run dev
    ```

4.  打开浏览器并访问 Vite 提供的本地 URL（通常是 `http://localhost:5173`）。
