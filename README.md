# GreenFlow 🌱

A comprehensive sustainability platform for retailers to track, predict, and optimize environmental footprint of their supply chains in real-time.

## 🌟 Features

### 1. Carbon Footprint Tracker
- Auto-compute emissions per shipment
- Trend charts & leaderboards
- Real-time carbon impact visualization

### 2. Predictive Waste Alerts
- AI-powered forecasting using TensorFlow.js
- Severity-ranked alert system
- Proactive waste reduction recommendations

### 3. Green Logistics Optimizer
- Geo-route scoring by fuel type & distance
- Interactive map integration
- Low-emission delivery route recommendations

### 4. Sustainable Supplier Marketplace
- ESG certification uploads
- Supplier search & approval workflows
- ESG score tracking and analytics

### 5. Consumer "Eco-Choice" Portal
- "Green Score" badges on products
- Opt-in for green delivery & minimal packaging
- Customer engagement tracking

## 🏗️ Architecture

- **Frontend**: React.js with TypeScript
- **Backend**: Node.js with Express
- **Database**: MongoDB Atlas
- **AI/ML**: TensorFlow.js for waste prediction
- **Maps**: Leaflet for route visualization
- **Charts**: Recharts for analytics
- **Styling**: Tailwind CSS

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.0.0
- MongoDB Atlas account
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd greenflow
```

2. **Install dependencies**
```bash
npm install
npm run install-client
```

3. **Environment Setup**
Create a `.env` file in the root directory:
```env
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
PORT=5000
```

4. **Run the application**
```bash
# Development mode (both frontend and backend)
npm run dev

# Production mode
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 📊 Data Models

### Suppliers
```javascript
{
  _id: ObjectId,
  name: String,
  certificationLevel: String, // "FairTrade", "Organic", etc.
  ESGscore: Number,
  auditDocs: [String], // URLs
  registeredAt: Date
}
```

### Shipments
```javascript
{
  _id: ObjectId,
  supplierId: ObjectId,
  productId: ObjectId,
  quantity: Number,
  distanceKm: Number,
  transportMode: String, // "diesel" | "electric" | "hybrid"
  carbonKg: Number, // computed at insertion
  timestamp: Date
}
```

### Products
```javascript
{
  _id: ObjectId,
  name: String,
  category: String,
  baseSpoilageRate: Number, // historical %
  packagingType: String // "plastic" | "recyclable" | "compostable"
}
```

### Waste Alerts
```javascript
{
  _id: ObjectId,
  productId: ObjectId,
  region: String,
  predictedWasteQty: Number,
  riskLevel: String, // "low" | "medium" | "high"
  alertDate: Date
}
```

## 🔌 API Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/login` | POST | Returns JWT token |
| `/api/shipments` | POST | Create shipment & compute carbonKg |
| `/api/suppliers` | GET | List/filter suppliers |
| `/api/suppliers/:id` | PUT | Update supplier ESG data |
| `/api/products/:id/predict-waste` | GET | Return next-week spoilage forecast |
| `/api/alerts` | GET | List active waste alerts |
| `/api/routes/optimize` | GET | Return top 3 green delivery routes |
| `/api/orders/eco-options` | POST | Record customer eco preferences |

## 🎯 Success Metrics

- **Waste Reduction**: % decrease in predicted spoilage vs. baseline
- **Emission Savings**: Total kg CO₂ saved by green routing
- **Supplier Adoption**: # of suppliers onboarded with ESG scores
- **Customer Engagement**: % of orders using eco-options

## 🔐 Authentication & Roles

- **Admin**: Full system access, supplier management
- **Supplier**: Upload certifications, view own data
- **Manager**: Analytics dashboard, waste alerts
- **Consumer**: Eco-choice portal, green score viewing

## 🛠️ Development

### Project Structure
```
greenflow/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API calls
│   │   ├── context/       # React context
│   │   └── utils/         # Utility functions
├── server/                # Node.js backend
│   ├── models/           # MongoDB schemas
│   ├── routes/           # API routes
│   ├── middleware/       # Custom middleware
│   ├── services/         # Business logic
│   └── utils/           # Helper functions
├── uploads/              # File uploads
└── docs/                # Documentation
```

### Available Scripts
- `npm run dev`: Start both frontend and backend in development
- `npm run server`: Start backend only
- `npm run client`: Start frontend only
- `npm run build`: Build frontend for production

## 🌍 Deployment

### Heroku
1. Create Heroku app
2. Set environment variables
3. Deploy: `git push heroku main`

### Vercel (Frontend)
1. Connect GitHub repository
2. Set build command: `npm run build`
3. Deploy automatically

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions, please open an issue in the GitHub repository or contact the development team.

---

**GreenFlow** - Empowering retailers to create a sustainable future 🌱 