"""Validate browser-delivered media without fetching arbitrary server-side URLs."""
import ipaddress
import re
from urllib.parse import urlsplit, parse_qs


def public_https(value: str, optional=True) -> str:
    value=value.strip()
    if not value and optional:
        return value
    try:
        u=urlsplit(value)
        host=(u.hostname or "").lower()
        if u.scheme != "https" or not host or u.username or u.password or u.port not in (None,443):
            raise ValueError()
        if any(c in value for c in ['\\','\r','\n','"',"'",'<','>']):
            raise ValueError()
        if host in {'localhost','metadata.google.internal','api.telegram.org'} or host.endswith(('.local','.internal','.localhost')) or '.' not in host:
            raise ValueError()
        try:
            address=ipaddress.ip_address(host)
        except ValueError:
            address=None
        if address and not address.is_global:
            raise ValueError()
        if re.search(r'(?:bot\d+:|[?&](?:token|access_token|api_key|secret)=)',value,re.I):
            raise ValueError()
    except (ValueError,TypeError):
        raise ValueError('Use a public HTTPS URL without credentials')
    return value


def video_source(value: str) -> tuple[str,str]:
    value=public_https(value,False)
    u=urlsplit(value)
    host=u.hostname.lower()
    if host in {'youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtube-nocookie.com'}:
        vid=u.path.strip('/') if host=='youtu.be' else parse_qs(u.query).get('v',[''])[0]
        if not vid and u.path.startswith(('/embed/','/shorts/')):
            vid=u.path.split('/')[2]
        if not re.fullmatch(r'[A-Za-z0-9_-]{11}',vid):
            raise ValueError('Invalid YouTube video URL')
        return 'youtube',f'https://www.youtube-nocookie.com/embed/{vid}'
    if host in {'vimeo.com','www.vimeo.com','player.vimeo.com'}:
        vid=u.path.rstrip('/').split('/')[-1]
        if not vid.isdigit():
            raise ValueError('Invalid Vimeo video URL')
        return 'vimeo',f'https://player.vimeo.com/video/{vid}'
    if u.path.lower().endswith(('.mp4','.webm','.ogg')):
        return 'file',value
    raise ValueError('Use YouTube, Vimeo, or a direct MP4/WebM/OGG HTTPS URL')
