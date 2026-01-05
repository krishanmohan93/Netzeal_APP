# NetZeal - AI-Powered Professional Growth Platform

![NetZeal](https://img.shields.io/badge/NetZeal-v1.0.0-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-green)
![React Native](https://img.shields.io/badge/React%20Native-0.72.6-blue)
![Python](https://img.shields.io/badge/Python-3.9+-blue)

NetZeal is an AI-powered social platform that blends professional networking, personalized learning, and intelligent content recommendations — all in one mobile app. It helps users connect, learn, and grow through data-driven insights, interactive AI assistance, and engaging professional content.

## 🌟 Features

### Core Features
- **👤 User Profiles**: Create comprehensive profiles with personal and professional details
- **📱 Content Ecosystem**: Share articles, videos, infographics, and professional posts
- **🤖 AI Assistant**: Conversational AI mentor for career guidance and learning recommendations
- **🔗 Networking**: Follow users, build professional connections, and collaborate
- **📊 Analytics**: Track engagement, views, and career growth metrics
- **🎯 Smart Recommendations**: AI-powered content, user, and course suggestions

### Technical Highlights
- **Vector Search**: Pinecone integration for similarity-based recommendations
- **OpenAI Integration**: GPT-4 for conversational AI and embeddings for content analysis
- **Real-time Feed**: Personalized content feed based on user interests
- **Engagement Tracking**: Comprehensive analytics for user behavior
- **Secure Authentication**: JWT-based authentication system

## 🏗️ Architecture

```
NetZeal/
├── backend/               # FastAPI Backend
│   ├── app/
│   │   ├── core/         # Configuration, database, security
│   │   ├── models/       # SQLAlchemy database models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── routers/      # API endpoints
│   │   ├── services/     # Business logic & AI services
│   │   └── main.py       # FastAPI application
│   └── requirements.txt
│
└── frontend/             # React Native Mobile App
    ├── src/
    │   ├── screens/      # App screens
    │   ├── navigation/   # Navigation setup
    │   ├── services/     # API services
    │   └── utils/        # Theme & utilities
    ├── App.js
    └── package.json
```

## 🚀 Getting Started

### Prerequisites

**Backend:**
- Python 3.9+
- PostgreSQL database
- OpenAI API key
- Pinecone API key

**Frontend:**
- Node.js 16+
- npm or yarn
- Expo CLI

### Backend Setup

1. **Navigate to backend directory:**
```powershell
cd backend
```

2. **Create virtual environment:**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

3. **Install dependencies:**
```powershell
pip install -r requirements.txt
```

4. **Configure environment variables:**
```powershell
cp .env.example .env
```

Edit `.env` file with your credentials:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/netzeal
SECRET_KEY=your-secret-key-here
OPENAI_API_KEY=your-openai-api-key
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=your-pinecone-environment
```

5. **Run the application:**
```powershell
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs`
- Alternative Docs: `http://localhost:8000/redoc`

### Frontend Setup

1. **Navigate to frontend directory:**
```powershell
cd frontend
```

2. **Install dependencies:**
```powershell
npm install
```

3. **Update API URL:**
Edit `src/services/api.js` and update the `API_BASE_URL`:
```javascript
const API_BASE_URL = 'http://YOUR_IP:8000/api/v1';
```
*Replace `YOUR_IP` with your computer's local IP address*

4. **Start the development server:**
```powershell
npm start
```

5. **Run on device:**
- Install Expo Go app on your mobile device
- Scan the QR code shown in terminal
- Or press `a` for Android emulator, `i` for iOS simulator

## 📚 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `GET /api/v1/auth/me` - Get current user profile
- `PUT /api/v1/auth/me` - Update user profile

### Content
- `GET /api/v1/content/posts` - Get legacy offset posts
- `POST /api/v1/content/posts` - Create new rich post (AI metadata)
- `GET /api/v1/content/posts/{id}` - Get specific post
- `POST /api/v1/content/posts/{id}/like` - Like a post
- `POST /api/v1/content/posts/{id}/comments` - Comment on post
- `POST /api/v1/content/upload-post` - Upload media (image/video/reel) and auto-publish
- `POST /api/v1/content/posts/draft` - Create unpublished draft (after obtaining media_url)
- `POST /api/v1/content/posts/{id}/publish` - Publish draft (fan-out + realtime)
- `GET /api/v1/content/feed-cursor` - New cursor-based feed (real-time fan-out)

### AI & Recommendations
- `POST /api/v1/ai/chat` - Chat with AI assistant
- `GET /api/v1/ai/recommendations/content` - Get content recommendations
- `GET /api/v1/ai/recommendations/users` - Get user recommendations
- `GET /api/v1/ai/recommendations/courses` - Get course recommendations
- `GET /api/v1/ai/analytics` - Get user analytics

### Social
- `POST /api/v1/social/follow/{id}` - Follow user
- `DELETE /api/v1/social/unfollow/{id}` - Unfollow user
- `GET /api/v1/social/followers` - Get followers list
- `GET /api/v1/social/following` - Get following list

## 🎨 Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM for database operations
- **PostgreSQL** - Primary database
- **OpenAI API** - GPT-4 for AI conversations & embeddings
- **Pinecone** - Vector database for similarity search
- **JWT** - Secure authentication
- **Pydantic** - Data validation

### Frontend
- **React Native** - Cross-platform mobile framework
- **Expo** - Development platform
- **React Navigation** - Navigation library
- **Axios** - HTTP client
- **AsyncStorage** - Local data storage
- **React Native Vector Icons** - Icon library

## 🤖 AI Features

### Conversational AI
- Career guidance and mentorship
- Learning path recommendations
- Skill development suggestions
- Professional networking tips

### Vector-Based Recommendations
- Content similarity matching
- User profile similarity
- Topic-based filtering
- Behavioral pattern analysis

### Analytics
- Engagement tracking
- Content performance metrics
- User behavior analysis
- Skill development progress

## 🔐 Security
## ⚙️ Environment Variables (Backend)

Add these to your `.env`:
```env
DATABASE_URL=postgresql://user:pass@host:5432/netzeal
SECRET_KEY=super-secret-string
OPENAI_API_KEY=your-openai-key
PINECONE_API_KEY=your-pinecone-key
PINECONE_ENVIRONMENT=your-pinecone-env
REDIS_URL=redis://localhost:6379/0            # optional (for feed cache invalidation)
STORAGE_BASE_URL=https://res.cloudinary.com/<cloud_name>/   # used for media delivery
```

## 🔌 WebSocket

Real-time feed updates (NEW_POST events) are broadcast over:
```
ws://<API_HOST>:8000/ws
```
Client receives JSON messages:
```json
{ "type": "NEW_POST", "post_id": 123 }
```
On receipt, refresh the head of the cursor feed or optimistically prepend if you have the post locally.

## 🗄️ Feed Architecture

- Upload or publish inserts a row into `posts` (with `is_published` + `published_at`).
- Fan-out creates `feed_items` for every user for O(1) per-user feed reads.
- Cursor ordering: `(published_at DESC, id DESC)` for stable pagination.
- Cursor format: `ISO_TIMESTAMP_postId` (e.g. `2025-11-11T10:15:30.123456+00:00_42`).
- Use `next_cursor` returned by `/content/feed-cursor` for infinite scroll.

## 🧪 Testing (Backend Suggested)

Recommended Pytest cases to add:
1. Publish draft creates feed_items for all existing users.
2. Cursor pagination returns deterministic ordering and `next_cursor`.
3. WebSocket broadcast sends NEW_POST message on publish.
4. Upload-post endpoint auto publishes and fan-outs.

## 🎨 Theme

Frontend uses a light golden professional palette (see `src/utils/theme.js`). Adjust primary gold tones to align with brand identity. Components should consume exported `colors`, `spacing`, `shadows` for consistency.


- JWT-based authentication
- Password hashing with bcrypt
- SQL injection protection via SQLAlchemy ORM
- CORS configuration
- Environment variable management

## 🚀 Deployment

### Backend Deployment (Render/Railway)

1. **Create account** on Render or Railway
2. **Connect your repository**
3. **Set environment variables**
4. **Deploy** - Platform will auto-detect FastAPI

### Frontend Deployment (EAS Build)

1. **Install EAS CLI:**
```powershell
npm install -g eas-cli
```

2. **Configure EAS:**
```powershell
eas build:configure
```

3. **Build for production:**
```powershell
eas build --platform android
eas build --platform ios
```

## 📱 Screenshots

*Add screenshots of your app here once implemented*

## 🛣️ Roadmap

### Phase 1 (Current)
- ✅ User authentication and profiles
- ✅ Content creation and feed
- ✅ AI chat assistant
- ✅ Basic recommendations
- ✅ Social networking features

### Phase 2 (Future)
- [ ] Web app version (Next.js)
- [ ] Job recommendations
- [ ] LinkedIn/Coursera API integration
- [ ] Real-time notifications
- [ ] Direct messaging
- [ ] Video content support
- [ ] AI content summarizer
- [ ] Skill gap analyzer

### Phase 3 (Future)
- [ ] Premium features
- [ ] Advanced analytics dashboard
- [ ] Team collaboration tools
- [ ] Learning paths tracking
- [ ] Certificate integration

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Authors

- **Your Name** - *Initial work*

## 🙏 Acknowledgments

- OpenAI for GPT-4 and embeddings API
- Pinecone for vector database
- FastAPI community
- React Native community
- Expo team

## 📞 Support

For support, email support@netzeal.com or join our community Discord.

## 🔗 Links

- [Documentation](https://docs.netzeal.com)
- [API Reference](https://api.netzeal.com/docs)
- [Community Forum](https://community.netzeal.com)

---

Made with ❤️ by the NetZeal Team
