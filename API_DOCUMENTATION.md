# NetZeal API Documentation

## Overview
NetZeal provides a comprehensive RESTful API for building professional networking and learning applications.

## Base URL
```
http://localhost:8000/api/v1
```

## Authentication
All authenticated endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_token_here>
```

## Endpoints

### Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "username": "string",
  "email": "user@example.com",
  "full_name": "string",
  "password": "string"
}

Response: 201 Created
{
  "id": 1,
  "username": "string",
  "email": "user@example.com",
  "full_name": "string",
  "is_active": true,
  "created_at": "2025-11-04T00:00:00Z"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=secret

Response: 200 OK
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

#### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>

Response: 200 OK
{
  "id": 1,
  "username": "string",
  "email": "user@example.com",
  "full_name": "string",
  "bio": "string",
  "skills": ["Python", "JavaScript"],
  "interests": ["AI", "Web Development"],
  "followers_count": 10,
  "following_count": 5,
  "posts_count": 3
}
```

### Content Management

#### Create Post
```http
POST /content/posts
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "My First Post",
  "content": "This is the content of my post...",
  "content_type": "post",
  "tags": ["technology", "career"]
}

Response: 201 Created
{
  "id": 1,
  "title": "My First Post",
  "content": "This is the content...",
  "author_id": 1,
  "likes_count": 0,
  "comments_count": 0,
  "created_at": "2025-11-04T00:00:00Z"
}
```

#### Get Posts Feed
```http
GET /content/posts?skip=0&limit=20
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "id": 1,
    "title": "Post Title",
    "content": "Post content...",
    "author_username": "john_doe",
    "likes_count": 5,
    "comments_count": 2,
    "is_liked": false,
    "is_bookmarked": false
  }
]
```

#### Like Post
```http
POST /content/posts/{post_id}/like
Authorization: Bearer <token>

Response: 200 OK
{
  "id": 1,
  "user_id": 1,
  "post_id": 1,
  "created_at": "2025-11-04T00:00:00Z"
}
```

### AI & Recommendations

#### Chat with AI
```http
POST /ai/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "What skills should I learn for a career in AI?"
}

Response: 200 OK
{
  "response": "For a career in AI, I recommend...",
  "intent": "learning_recommendation",
  "recommendations": [
    {
      "course_name": "Machine Learning Specialization",
      "platform": "Coursera",
      "reason": "Foundational ML concepts"
    }
  ],
  "created_at": "2025-11-04T00:00:00Z"
}
```

#### Get Content Recommendations
```http
GET /ai/recommendations/content?limit=10
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "id": 1,
    "title": "Recommended Post",
    "content": "Content preview...",
    "likes_count": 10
  }
]
```

#### Get Course Recommendations
```http
GET /ai/recommendations/courses
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "course_name": "Python for Data Science",
    "platform": "Coursera",
    "reason": "Matches your interest in data science"
  }
]
```

#### Get User Analytics
```http
GET /ai/analytics
Authorization: Bearer <token>

Response: 200 OK
{
  "user_id": 1,
  "total_posts": 5,
  "total_likes": 50,
  "total_views": 500,
  "engagement_rate": 10.0,
  "top_topics": ["AI", "Python", "Career"]
}
```

### Social Networking

#### Follow User
```http
POST /social/follow/{user_id}
Authorization: Bearer <token>

Response: 200 OK
{
  "message": "Successfully followed username"
}
```

#### Get Followers
```http
GET /social/followers?skip=0&limit=50
Authorization: Bearer <token>

Response: 200 OK
[
  {
    "id": 2,
    "username": "follower_user",
    "full_name": "Follower Name",
    "bio": "User bio"
  }
]
```

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Invalid input data"
}
```

### 401 Unauthorized
```json
{
  "detail": "Could not validate credentials"
}
```

### 404 Not Found
```json
{
  "detail": "Resource not found"
}
```

### 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

## Rate Limiting
Currently no rate limiting is implemented. Will be added in future versions.

## Pagination
Most list endpoints support pagination via `skip` and `limit` query parameters:
- `skip`: Number of records to skip (default: 0)
- `limit`: Maximum number of records to return (default: 20, max: 100)

## Content Types
Posts can have the following content types:
- `post` - Short text post
- `article` - Long-form article
- `video` - Video content
- `infographic` - Visual content

## Best Practices
1. Always include proper error handling in your client
2. Store tokens securely (use AsyncStorage in React Native)
3. Refresh token before expiration
4. Use pagination for large data sets
5. Cache responses when appropriate

## Webhook Events (Coming Soon)
Future versions will support webhooks for real-time updates.
