"""All Pydantic request/response models and shared type literals."""
from typing import List, Optional, Literal
from pydantic import BaseModel, EmailStr


# ---------- Type literals ----------
GroupType = Literal["aspirant", "practitioner", "employer"]
PostType = Literal["question", "discussion", "success_story"]
DocType = Literal["fix_guide", "how_to", "learning_bite", "reference", "checklist"]
Difficulty = Literal["beginner", "intermediate", "advanced"]


# ---------- Auth ----------
class RegisterIn(BaseModel):
    full_name: str
    username: str
    email: EmailStr
    password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileSetupIn(BaseModel):
    group_type: GroupType
    workday_modules: List[str] = []
    years_experience: Optional[int] = None
    bio: Optional[str] = None
    company_name: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    current_role: Optional[str] = None
    employment_type: Optional[str] = None
    company_role: Optional[str] = None
    here_for: Optional[str] = None
    company_size: Optional[str] = None
    goals: Optional[str] = None


class EmergentSessionIn(BaseModel):
    session_id: str


# ---------- Community ----------
class PostIn(BaseModel):
    space_slug: str
    type: PostType
    title: str
    body: str
    tags: List[str] = []


class AnswerIn(BaseModel):
    body: str


class CommentIn(BaseModel):
    body: str


class VoteIn(BaseModel):
    target_id: str
    target_type: Literal["post", "answer"]
    value: int


class ReportIn(BaseModel):
    target_id: str
    target_type: Literal["post", "answer", "comment"]
    reason: str


# ---------- Knowledge Base ----------
class KBHelpfulIn(BaseModel):
    value: Literal["helpful", "not_helpful"]


class KBFeedbackIn(BaseModel):
    helpful: bool


class KBDocIn(BaseModel):
    title: str
    summary: str
    body: str
    category_slug: str
    doc_type: DocType
    difficulty: Difficulty
    target_groups: List[GroupType] = ["aspirant", "practitioner", "employer"]
    tags: List[str] = []
    workday_version: Optional[str] = None
    publish: bool = True
    # Extended metadata captured from .docx uploads
    reference_id: Optional[str] = None
    sub_module: Optional[str] = None
    read_time: Optional[str] = None
    platform: Optional[str] = None


# ---------- Admin ----------
class MemberPatchIn(BaseModel):
    group_type: Optional[GroupType] = None
    is_suspended: Optional[bool] = None
    is_admin: Optional[bool] = None


class PostPatchIn(BaseModel):
    is_pinned: Optional[bool] = None
    is_removed: Optional[bool] = None


class ReportPatchIn(BaseModel):
    status: Literal["reviewed", "dismissed"]
    remove_content: Optional[bool] = False


class SpaceCreateIn(BaseModel):
    slug: str
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "Hash"


class SpacePatchIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_hidden: Optional[bool] = None


class KBDocPatchIn(BaseModel):
    is_published: Optional[bool] = None
    is_featured: Optional[bool] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    body: Optional[str] = None
    category_slug: Optional[str] = None
    doc_type: Optional[DocType] = None
    difficulty: Optional[Difficulty] = None
    target_groups: Optional[List[GroupType]] = None
    tags: Optional[List[str]] = None
    workday_version: Optional[str] = None
    reference_id: Optional[str] = None
    sub_module: Optional[str] = None
    read_time: Optional[str] = None
    platform: Optional[str] = None


class KBCategoryCreateIn(BaseModel):
    slug: str
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "📚"
    sort_order: Optional[int] = 99


class KBCategoryPatchIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    sort_order: Optional[int] = None
    is_hidden: Optional[bool] = None
