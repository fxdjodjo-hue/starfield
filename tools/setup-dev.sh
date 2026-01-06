#!/bin/bash

# Starfield MMO Development Setup Script
# This script sets up the development environment

echo "🚀 Setting up Starfield MMO Development Environment"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🗄️ Setting up Supabase (if available)..."
if command -v npx &> /dev/null; then
    npx supabase start 2>/dev/null || echo "⚠️ Supabase CLI not available or not configured"
else
    echo "⚠️ npx not available"
fi

echo "✅ Setup complete!"
echo ""
echo "Available commands:"
echo "  npm run dev          - Start client development server"
echo "  npm run server       - Start game server"
echo "  npm run dev:full     - Start both client and server"
echo "  npm run build        - Build for production"
echo "  npm test             - Run tests"
echo ""
echo "Happy coding! 🎮✨"


