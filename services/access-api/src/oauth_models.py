"""SQLAlchemy persistence models for OAuth credentials and grants."""

from sqlalchemy import Column, ForeignKey, Integer, String, Text

from src.db import Base


class OAuthClient(Base):
    __tablename__ = "oauth_clients"

    client_id = Column(String(128), primary_key=True)
    client_name = Column(String(200), nullable=False)
    redirect_uris_json = Column(Text, nullable=False)
    created_at = Column(Integer, nullable=False)


class OAuthAuthorizationRequest(Base):
    __tablename__ = "oauth_authorization_requests"

    request_hash = Column(String(128), primary_key=True)
    client_id = Column(
        String(128), ForeignKey("oauth_clients.client_id"), nullable=False
    )
    redirect_uri = Column(Text, nullable=False)
    state = Column(Text, nullable=False)
    code_challenge = Column(String(128), nullable=False)
    resource = Column(Text, nullable=False)
    scope = Column(String(500), nullable=False)
    expires_at = Column(Integer, nullable=False, index=True)


class OAuthAuthorizationCode(Base):
    __tablename__ = "oauth_authorization_codes"

    code_hash = Column(String(128), primary_key=True)
    client_id = Column(
        String(128), ForeignKey("oauth_clients.client_id"), nullable=False
    )
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    redirect_uri = Column(Text, nullable=False)
    code_challenge = Column(String(128), nullable=False)
    resource = Column(Text, nullable=False)
    scope = Column(String(500), nullable=False)
    expires_at = Column(Integer, nullable=False, index=True)
    used_at = Column(Integer, nullable=True)


class OAuthAccessToken(Base):
    __tablename__ = "oauth_access_tokens"

    token_hash = Column(String(128), primary_key=True)
    family_id = Column(String(128), nullable=False, index=True)
    client_id = Column(
        String(128), ForeignKey("oauth_clients.client_id"), nullable=False
    )
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    resource = Column(Text, nullable=False)
    scope = Column(String(500), nullable=False)
    expires_at = Column(Integer, nullable=False, index=True)
    revoked_at = Column(Integer, nullable=True)


class OAuthRefreshToken(Base):
    __tablename__ = "oauth_refresh_tokens"

    token_hash = Column(String(128), primary_key=True)
    family_id = Column(String(128), nullable=False, index=True)
    client_id = Column(
        String(128), ForeignKey("oauth_clients.client_id"), nullable=False
    )
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    resource = Column(Text, nullable=False)
    scope = Column(String(500), nullable=False)
    expires_at = Column(Integer, nullable=False, index=True)
    used_at = Column(Integer, nullable=True)
    revoked_at = Column(Integer, nullable=True)
