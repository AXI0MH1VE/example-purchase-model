# Smart Pairing Engine — Axiom Hive

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/AXIOMHIVE/example-purchase-model)
[![Engine](https://img.shields.io/badge/engine-Hybrid--Rec-green.svg)](https://github.com/AXIOMHIVE/example-purchase-model)
[![License](https://img.shields.io/badge/license-PROPRIETARY-red.svg)](https://github.com/AXIOMHIVE/example-purchase-model)

> **"Double your sales by showing customers exactly what they need next."**

The **Smart Pairing Engine** (v1.0) is a sophisticated, high-performance recommendation system developed for Axiom Hive. It integrates multiple algorithmic layers to provide real-time, high-accuracy product pairings, user recommendations, and behavioral economics nudge packages.

---

## ◈ Core Architecture

The engine utilizes a hybrid approach to circumvent the "cold start" problem and maximize Average Order Value (AOV).

### 1. Engine Layers
- **Association Rule Learning (ARL):** Uses Apriori-inspired logic to identify "Customers who bought X also bought Y" patterns with high Lift and Confidence metrics.
- **Collaborative Filtering (CF):** Analyzes user behavior across the entire dataset to find similarities between users and items.
- **Content-Based Filtering (CB):** Recommends items based on intrinsic product attributes and categorical proximity.
- **Clickstream Analyzer:** Real-time intent monitoring that scores user sessions based on navigation patterns (e.g., rapid scrolling, repeat views, cart additions).

### 2. Behavioral Intelligence
- **Bundle Builder:** Dynamically generates high-AOV bundles (Entry, Mid, High tiers).
- **Social Proof Layer:** Injects real-time "Bandwagon" metrics (e.g., "42 others are viewing this right now").
- **Scarcity & Urgency:** Implements Loss Aversion strategies using inventory and popularity signals.

---

## ◈ Technical Stack

- **Backend:** Node.js, Express.js
- **Frontend:** Vanilla JavaScript (ES6+), CSS3 (Modern Monochrome Aesthetic)
- **Data:** Synthetic Generator (supports 10k+ events/sec)
- **Intelligence:** Proprietary algorithms in `/engine`

---

## ◈ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AXIOMHIVE/example-purchase-model.git
   cd example-purchase-model
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Generate synthetic data:**
   ```bash
   npm run generate-data
   ```

4. **Launch the engine:**
   ```bash
   npm start
   ```

5. **Access the Dashboard:**
   Open `http://localhost:3000` in your browser.

---

## ◈ API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/metrics` | `GET` | System-wide performance and AOV uplift metrics. |
| `/api/products` | `GET` | Complete product catalog with category filtering. |
| `/api/pairings/:sku` | `GET` | Hybrid pairings (ARL + CF + CB) for a specific product. |
| `/api/bundles/:sku` | `GET` | Full behavioral economics package for a product. |
| `/api/session/analyze` | `POST` | Real-time clickstream intent analysis. |

---

## ◈ Directory Structure

```text
├── data/               # Data generation logic
├── engine/             # Core algorithmic layers
│   ├── association-rules.js
│   ├── behavioral-economics.js
│   ├── clickstream-analyzer.js
│   └── ...
├── public/             # Dashboard UI (HTML/CSS/JS)
├── server.js           # Express API & Engine Orchestrator
└── package.json        # Project metadata
```

---

## ◈ License

**PROPRIETARY — AXIOM HIVE / NMG**  
Unauthorized copying or distribution of this software is strictly prohibited. For licensing inquiries, please contact NMG.

---

Developed by **NMG** for **Axiom Hive**.  
*March 2026 Release*
