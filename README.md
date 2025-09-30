# DigitalMemoTag Factory Management System

A comprehensive factory management system for tracking products and enabling real-time communication between workers and managers.

## Features

- **Admin Dashboard**: Secure login with visual status indicators
- **QR Code Integration**: Easy mobile access to product information
- **Real-time Messaging**: Communication between workers and managers
- **Status Tracking**: Color-coded status system (Working/Completed/Delayed/Problem)
- **Mobile Optimized**: Touch-friendly interface for factory workers

## Setup Instructions

### 1. Clone Repository
```bash
git clone [your-repo-url]
cd digitalmemotag
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create `.env.local` file with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://lnkfzzofnxvwtdmywfup.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxua2Z6em9mbnh2d3RkbXl3ZnVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3MjI1MTksImV4cCI6MjA3MzI5ODUxOX0.gul7vVBQiGg9p4_JGfMWdnIvKQM0nTXW672G3mAehEA
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
npm start
```

## Deployment on Vercel

1. Push code to GitHub repository
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on push

## Usage

### Admin Access
- Login with passcode: `1234`
- Create new product tags
- Monitor all product statuses
- View and respond to messages

### Worker Access
- Scan QR codes attached to products
- Send status updates using quick buttons
- Post custom messages
- View message history

### QR Code URLs
Generate QR codes pointing to:
```
https://yourapp.vercel.app/?item=[PRODUCT_ID]
```

## Database Schema

The application uses Supabase with the following tables:
- `items`: Product information and status
- `messages`: Communication logs and status updates

## Quick Actions
- 🔵 Blue: "作業を開始しました" (Work started)
- 🟢 Green: "作業を完了しました" (Work completed)
- 🟡 Yellow: "作業に遅れが生じています" (Work delayed)
- 🔴 Red: "問題が発生しました。" (Problem occurred)

## Support

For technical support, please contact your system administrator. 
