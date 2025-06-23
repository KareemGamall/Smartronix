# Smartronics E-commerce Platform

A modern, production-ready e-commerce platform built with Node.js, Express, MongoDB, and EJS. Features include user authentication, cart management, order processing, admin panel, and comprehensive monitoring.

## 🚀 Features

### Core Features
- **User Authentication**: JWT-based authentication with session management
- **Cart System**: Guest and authenticated user cart with migration
- **Product Management**: CRUD operations with categories and search
- **Order Processing**: Complete checkout flow with order tracking
- **Admin Panel**: Comprehensive admin dashboard for managing products, orders, and users
- **Responsive Design**: Mobile-first design with Bootstrap 5

### Production Features
- **Error Tracking**: Sentry integration for real-time error monitoring
- **Structured Logging**: Winston-based logging with file rotation
- **Rate Limiting**: Configurable rate limiting for API endpoints
- **Input Validation**: Comprehensive validation using express-validator
- **Performance Monitoring**: Request timing and slow query detection
- **Health Checks**: Built-in health check endpoints
- **Security**: CORS, session security, and input sanitization

### Developer Experience
- **Testing**: Jest test suite with coverage reporting
- **Code Quality**: ESLint configuration
- **Documentation**: Comprehensive deployment and API documentation
- **Notifications**: Toast notification system for better UX

## 📋 Prerequisites

- Node.js 16+ and npm 8+
- MongoDB (Atlas recommended for production)
- Git

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/smartronics.git
   cd smartronics
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Database setup**
   - Create MongoDB database
   - Update MONGODB_URI in .env
   - Run database indexes (see deployment guide)

5. **Start development server**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Required Environment Variables
```bash
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smartronics
JWT_SECRET_PHRASE=your-super-secret-jwt-key
SESSION_SECRET=your-super-secret-session-key
```

### Optional Environment Variables
```bash
SENTRY_DSN=your-sentry-dsn-here
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=debug
```

## 📁 Project Structure

```
smartronics/
├── config/                 # Configuration files
│   ├── db.js              # Database connection
│   └── logger.js          # Winston logging setup
├── controllers/           # Business logic
│   ├── cartController.js  # Cart operations
│   ├── user.js           # User authentication
│   └── ...
├── middleware/            # Express middleware
│   ├── auth.js           # Authentication middleware
│   └── validation.js     # Input validation
├── models/               # MongoDB models
│   ├── Cart.js          # Cart schema
│   ├── Products.js      # Product schema
│   └── ...
├── public/               # Static assets
│   ├── css/             # Stylesheets
│   ├── js/              # Client-side JavaScript
│   └── uploads/         # File uploads
├── routes/               # Express routes
│   ├── cart.js          # Cart routes
│   ├── user.js          # User routes
│   └── ...
├── tests/                # Test files
│   ├── setup.js         # Jest setup
│   └── cart.test.js     # Cart tests
├── views/                # EJS templates
│   ├── layouts/         # Layout templates
│   ├── pages/           # Page templates
│   └── partials/        # Reusable components
├── logs/                 # Application logs
├── server.js            # Main application file
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run in CI mode
npm run test:ci
```

### Test Coverage
- Unit tests for controllers
- Integration tests for API endpoints
- Cart functionality tests
- User authentication tests

## 🚀 Deployment

### Quick Deploy to Render
1. Fork this repository
2. Connect to Render
3. Configure environment variables
4. Deploy

### Manual Deployment
See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## 📊 Monitoring

### Health Checks
- `GET /health` - Application health status
- `GET /api/session-status` - Session status
- `GET /debug-session` - Session debugging

### Logging
- Error logs: `./logs/error.log`
- Combined logs: `./logs/combined.log`
- Structured JSON logging
- Log rotation (5MB files, 5 files max)

### Error Tracking
- Sentry integration for real-time error monitoring
- Automatic error reporting
- Performance monitoring

## 🔒 Security Features

- **Rate Limiting**: Configurable limits for different endpoints
- **Input Validation**: Comprehensive validation for all inputs
- **Session Security**: Secure session management
- **CORS Protection**: Configurable CORS settings
- **JWT Security**: Secure token-based authentication
- **SQL Injection Protection**: Mongoose ODM protection
- **XSS Protection**: Output encoding

## 🛍️ API Endpoints

### Authentication
- `POST /api/user/signup` - User registration
- `POST /api/user/login` - User login
- `GET /api/user/logout` - User logout
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile

### Cart Operations
- `POST /cart/add` - Add item to cart
- `GET /cart` - Get cart contents
- `PUT /cart/update/:productId` - Update item quantity
- `DELETE /cart/remove/:productId` - Remove item from cart
- `DELETE /cart/clear` - Clear entire cart
- `GET /cart/view` - View cart page

### Products
- `GET /products` - List all products
- `GET /products/category/:id` - Products by category
- `GET /products/:id` - Product details

### Orders
- `GET /order/checkout` - Checkout page
- `POST /order/place` - Place order
- `GET /order/success` - Order success page

## 🎨 Frontend Features

### Notification System
- Toast notifications for user feedback
- Success, error, warning, and info types
- Auto-dismiss with manual close option
- Global error handling

### Cart Management
- Real-time cart updates
- Guest cart with login migration
- Quantity controls
- Cart persistence

### Responsive Design
- Mobile-first approach
- Bootstrap 5 framework
- Dark/light theme toggle
- Optimized for all devices

## 🔧 Development

### Available Scripts
```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm test           # Run tests
npm run test:watch # Run tests in watch mode
npm run lint       # Run ESLint
npm run lint:fix   # Fix ESLint issues
```

### Code Style
- ESLint configuration included
- Consistent code formatting
- JSDoc comments for functions
- Clear variable naming

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Write tests for new features
- Follow existing code style
- Update documentation
- Test thoroughly before submitting

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help
1. Check the [documentation](./DEPLOYMENT.md)
2. Review existing issues
3. Check application logs
4. Contact the development team

### Common Issues
- **Session Issues**: Check session configuration and cookies
- **Cart Problems**: Verify cart migration logic
- **Database Errors**: Check MongoDB connection and indexes
- **Performance**: Monitor logs and database queries

## 🗺️ Roadmap

### Planned Features
- [ ] Payment gateway integration (Stripe)
- [ ] Email notifications
- [ ] Advanced search and filtering
- [ ] Product reviews and ratings
- [ ] Wishlist functionality
- [ ] Multi-language support
- [ ] Advanced admin analytics
- [ ] Mobile app API
- [ ] Redis caching
- [ ] CDN integration

### Performance Improvements
- [ ] Database query optimization
- [ ] Image optimization
- [ ] Lazy loading
- [ ] Service worker for offline support
- [ ] Advanced caching strategies

## 📈 Performance Metrics

### Current Benchmarks
- **Response Time**: < 200ms average
- **Database Queries**: Optimized with indexes
- **Memory Usage**: Efficient session management
- **Error Rate**: < 0.1% with Sentry monitoring

### Optimization Areas
- Database query optimization
- Static asset compression
- CDN integration
- Caching strategies

---

**Built with ❤️ by the Smartronics Team** 