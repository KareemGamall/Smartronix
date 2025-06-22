# Smartronics Deployment Guide

## Free Deployment Options

### Option 1: Render (Recommended)

#### Step 1: Prepare Your Code
1. Make sure your code is in a GitHub repository
2. Ensure all dependencies are in `package.json`
3. Your app is now ready for deployment

#### Step 2: Deploy on Render
1. Go to [render.com](https://render.com) and sign up
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: smartronics
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

#### Step 3: Set Environment Variables
In Render dashboard, go to Environment and add:
```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET_PHRASE=your_jwt_secret
SESSION_SECRET=your_session_secret
NODE_ENV=production
```

#### Step 4: Deploy
Click "Create Web Service" and wait for deployment.

### Option 2: Railway

#### Step 1: Deploy on Railway
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect Node.js

#### Step 2: Set Environment Variables
In Railway dashboard, add the same environment variables as above.

### Option 3: Vercel

#### Step 1: Deploy on Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "New Project"
4. Import your repository
5. Configure as Node.js project

## Free Domain Options

### Option 1: Freenom (Free Domains)
1. Go to [freenom.com](https://freenom.com)
2. Search for available domains (.tk, .ml, .ga, .cf, .gq)
3. Register for free (12 months)
4. Point DNS to your hosting provider

### Option 2: Custom Subdomain
Most hosting providers offer free subdomains:
- Render: `your-app.onrender.com`
- Railway: `your-app.railway.app`
- Vercel: `your-app.vercel.app`

### Option 3: GitHub Pages (For Static Sites)
If you create a static version of your site:
1. Create a `gh-pages` branch
2. Push static files
3. Enable GitHub Pages in repository settings
4. Get `username.github.io/repository-name`

## Setting Up Custom Domain

### For Render:
1. Go to your service dashboard
2. Click "Settings" → "Custom Domains"
3. Add your domain
4. Update DNS records at your domain registrar:
   ```
   Type: CNAME
   Name: @
   Value: your-app.onrender.com
   ```

### For Railway:
1. Go to project settings
2. Add custom domain
3. Update DNS records

## Environment Variables Setup

Create a `.env` file locally (don't commit this):
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
JWT_SECRET_PHRASE=your_secure_jwt_secret
SESSION_SECRET=your_secure_session_secret
NODE_ENV=production
PORT=3000
```

## Security Considerations

1. **Never commit sensitive data** to your repository
2. **Use strong secrets** for JWT and session
3. **Enable HTTPS** (most platforms do this automatically)
4. **Set up proper CORS** for production
5. **Use environment variables** for all sensitive data

## Troubleshooting

### Common Issues:
1. **Port issues**: Make sure to use `process.env.PORT`
2. **Database connection**: Ensure MongoDB Atlas allows connections from anywhere
3. **Static files**: Make sure paths are correct for production
4. **Environment variables**: Double-check all are set in hosting platform

### Performance Tips:
1. **Enable compression** (already in your code)
2. **Use CDN** for static assets
3. **Optimize images** before uploading
4. **Enable caching** headers

## Monitoring

Most platforms provide:
- **Logs**: View application logs
- **Metrics**: CPU, memory usage
- **Uptime**: Service availability
- **Performance**: Response times

## Cost Optimization

### Free Tier Limits:
- **Render**: 750 hours/month
- **Railway**: $5 credit/month
- **Vercel**: Unlimited deployments
- **Netlify**: Unlimited deployments

### Tips:
1. **Monitor usage** to stay within limits
2. **Optimize code** to reduce resource usage
3. **Use caching** to reduce database calls
4. **Compress assets** to reduce bandwidth

## Next Steps

1. **Choose a hosting platform** (Render recommended)
2. **Set up your GitHub repository**
3. **Deploy your application**
4. **Configure environment variables**
5. **Set up a custom domain** (optional)
6. **Test thoroughly** in production
7. **Monitor performance** and logs 