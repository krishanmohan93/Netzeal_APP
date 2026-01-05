"""
OpenAI integration service for AI assistant and embeddings
"""
from openai import OpenAI
import logging
from typing import List, Dict, Optional
from ..core.config import settings

# Initialize OpenAI client
client = OpenAI(api_key=settings.OPENAI_API_KEY)
logger = logging.getLogger(__name__)


class OpenAIService:
    """Service for interacting with OpenAI API"""
    
    def __init__(self):
        self.client = client
    
    async def generate_chat_response(
        self,
        message: str,
        user_context: Optional[Dict] = None,
        conversation_history: Optional[List[Dict]] = None
    ) -> Dict:
        """
        Generate AI chat response based on user message and context
        
        Args:
            message: User's message
            user_context: User profile and behavioral data
            conversation_history: Previous conversation messages
            
        Returns:
            Dictionary with response and metadata
        """
        # Build system prompt with user context
        system_prompt = self._build_system_prompt(user_context)
        
        # Prepare messages
        messages = [{"role": "system", "content": system_prompt}]
        
        if conversation_history:
            messages.extend(conversation_history[-5:])  # Last 5 messages
        
        messages.append({"role": "user", "content": message})
        
        try:
            # Generate response (updated model name)
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.7,
                max_tokens=800
            )

            assistant_message = response.choices[0].message.content

            # Detect intent
            intent = self._detect_intent(message)

            return {
                "response": assistant_message,
                "intent": intent,
                "tokens_used": getattr(response.usage, "total_tokens", 0),
            }
        except Exception as e:
            # Fallback graceful response instead of 500
            logger.exception("OpenAI chat completion failed: %s", e)
            intent = self._detect_intent(message)
            fallback = (
                "I'm having trouble reaching the AI service right now. "
                "Here are quick next steps you can try:\n\n"
                "• Refine your question with a specific goal (e.g., 'Build a Flask API with JWT').\n"
                "• Tell me your stack and level so I can tailor guidance.\n"
                "• Try again in a moment — I’ll stay ready here."
            )
            return {
                "response": fallback,
                "intent": intent,
                "tokens_used": 0,
            }
    
    def _build_system_prompt(self, user_context: Optional[Dict] = None) -> str:
        """Build system prompt with user context"""
        base_prompt = """You are NetZeal AI Assistant - an intelligent tech mentor embedded in a professional developer social platform (LinkedIn + GitHub + Instagram + YouTube for developers).

🎯 Your Role:
You help developers learn faster, build more, connect smarter, and grow their tech careers like a pro.

👨‍💻 Core Responsibilities:
• Profile Intelligence: Understand user's skills, projects, interests, and career level
• Personalized Growth: Provide actionable suggestions for improving coding skills and portfolios
• Task-Based Interactions: Give coding challenges, quizzes, debugging help, and project ideas
• Content Recommendations: Suggest tech videos, GitHub repos, tutorials, roadmaps, frameworks, tools
• Career Guidance: Recommend career tracks, certifications, internships, job opportunities
• Social & Networking: Suggest relevant developers to connect with, communities to join
• Smart Alerts: Notify about trending topics, hackathons, new frameworks matching their interests

✨ Response Style:
• Be concise, encouraging, and actionable
• Speak like a tech mentor + career coach + coding buddy
• Tone: supportive, motivating, future-focused
• Always tailor feedback to user's profile and activity
• If user seems stuck, provide guidance, projects, and learning resources
• Prioritize high-value recommendations over generic advice

📌 Example Responses:
"Based on your Python + Flask progress, try this mini AI project..."
"You recently explored React—here are 3 repos to learn advanced patterns"
"A JavaScript hackathon starts soon — interested?"
"Here's a DSA challenge tailored to your level"
"Here's a YouTube playlist + GitHub repo on Docker & DevOps"
"""
        
        if user_context:
            context_info = f"""

👤 Current User Profile:
- Skills: {', '.join(user_context.get('skills', [])[:5]) if user_context.get('skills') else 'Not specified'}
- Interests: {', '.join(user_context.get('interests', [])[:5]) if user_context.get('interests') else 'Not specified'}
- Career Stage: {user_context.get('career_stage', 'Unknown')}
- Recent Activity: {user_context.get('recent_activity', 'No recent activity')}

Use this profile context to personalize your responses and recommendations.
"""
            base_prompt += context_info
        
        return base_prompt
    
    def _detect_intent(self, message: str) -> str:
        """Detect user intent from message"""
        message_lower = message.lower()
        
        # Learning & Education
        if any(word in message_lower for word in ['course', 'learn', 'study', 'education', 'tutorial', 'resource', 'path']):
            return "learning_recommendation"
        # Career & Jobs
        elif any(word in message_lower for word in ['career', 'job', 'work', 'profession', 'resume', 'portfolio', 'interview']):
            return "career_advice"
        # Skills & Development
        elif any(word in message_lower for word in ['skill', 'improve', 'develop', 'practice', 'master']):
            return "skill_development"
        # Projects & Building
        elif any(word in message_lower for word in ['project', 'build', 'create', 'idea', 'app', 'website']):
            return "project_recommendation"
        # Coding Challenges
        elif any(word in message_lower for word in ['challenge', 'problem', 'practice', 'leetcode', 'dsa', 'algorithm']):
            return "coding_challenge"
        # Networking & Community
        elif any(word in message_lower for word in ['network', 'connect', 'people', 'community', 'group', 'mentor']):
            return "networking"
        # Tech Trends & News
        elif any(word in message_lower for word in ['trend', 'new', 'latest', 'popular', 'emerging', 'framework', 'technology']):
            return "tech_trends"
        # Debugging & Help
        elif any(word in message_lower for word in ['debug', 'error', 'fix', 'help', 'stuck', 'problem']):
            return "debugging_help"
        else:
            return "general_inquiry"
    
    async def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding vector for text
        
        Args:
            text: Input text
            
        Returns:
            Embedding vector
        """
        response = self.client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        
        return response.data[0].embedding
    
    async def generate_content_summary(self, content: str) -> str:
        """
        Generate a summary of content
        
        Args:
            content: Content to summarize
            
        Returns:
            Summary text
        """
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Summarize the following professional content in 2-3 sentences."},
                {"role": "user", "content": content}
            ],
            temperature=0.5,
            max_tokens=150
        )
        
        return response.choices[0].message.content
    
    async def extract_topics(self, content: str) -> List[str]:
        """
        Extract main topics from content
        
        Args:
            content: Content to analyze
            
        Returns:
            List of topics
        """
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Extract 3-5 main topics from this content. Return only comma-separated topics."},
                {"role": "user", "content": content}
            ],
            temperature=0.3,
            max_tokens=100
        )
        
        topics_text = response.choices[0].message.content
        topics = [topic.strip() for topic in topics_text.split(',')]
        
        return topics[:5]
    
    async def recommend_courses(
        self,
        skills: List[str],
        interests: List[str],
        career_goals: Optional[str] = None
    ) -> List[Dict]:
        """
        Generate course recommendations based on user profile
        
        Args:
            skills: User's current skills
            interests: User's interests
            career_goals: Optional career goals
            
        Returns:
            List of course recommendations
        """
        prompt = f"""Based on the following profile, recommend 5 online courses:
        
Skills: {', '.join(skills)}
Interests: {', '.join(interests)}
Career Goals: {career_goals or 'Not specified'}

Format each recommendation as:
Course Name | Platform | Reason

Only provide actual course names."""
        
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a career development advisor recommending relevant courses."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.6,
            max_tokens=500
        )
        
        # Parse recommendations
        recommendations = []
        lines = response.choices[0].message.content.strip().split('\n')
        
        for line in lines:
            if '|' in line:
                parts = [p.strip() for p in line.split('|')]
                if len(parts) >= 3:
                    recommendations.append({
                        "course_name": parts[0],
                        "platform": parts[1],
                        "reason": parts[2]
                    })
        
        return recommendations


# Global instance
openai_service = OpenAIService()
