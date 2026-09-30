"""Create the first production super administrator without a hardcoded credential."""

import argparse
import getpass
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.entities import User, Player, AdminUser, Game
from app.core.security import passwords


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--nickname", default="Organizer")
    args = parser.parse_args()
    password = getpass.getpass("New administrator password (12+ characters): ")
    if len(password) < 12 or password != getpass.getpass("Confirm password: "):
        raise SystemExit("Passwords must match and contain at least 12 characters.")
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.role == "SUPER_ADMIN")):
            raise SystemExit(
                "A super administrator already exists. Use role management instead."
            )
        if db.scalar(select(User.id).where(User.email == args.email.lower())):
            raise SystemExit("That email already exists.")
        for slug, name in [("efootball", "eFootball"), ("pubg", "PUBG Mobile")]:
            if not db.scalar(select(Game.id).where(Game.slug == slug)):
                db.add(Game(slug=slug, name=name))
        user = User(
            email=args.email.lower(),
            password_hash=passwords.hash(password),
            role="SUPER_ADMIN",
        )
        db.add(user)
        db.flush()
        db.add(Player(user_id=user.id, nickname=args.nickname, full_name=args.nickname))
        db.add(AdminUser(user_id=user.id))
        db.commit()
    print("Administrator created.")


if __name__ == "__main__":
    main()
