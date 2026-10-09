"""Run through Django manage.py shell inside the existing blog container.

Stage the article and screenshot in /tmp, inspect with PUBLISH unset,
then set PUBLISH=1 after taking DB, media, and Works revision backups.
"""
import os
import re
from pathlib import Path

from django.core.files import File
from django.db import transaction
from django.utils import timezone
from PIL import Image as PillowImage
from wagtail.images import get_image_model

from blog.models import BlogIndexPage, BlogPostPage, Category
from home.models import WorkItem, WorksPage

slug = "rirekisho-studio-local-first"
key = "rirekisho-studio"
body = Path("/tmp/rirekisho-article.txt").read_text(encoding="utf-8").strip()
count = len(re.sub(r"\s", "", body))
assert 2000 <= count <= 3000, count
with PillowImage.open("/tmp/rirekisho-studio-works.png") as preview:
    preview.verify()
category = Category.objects.get(slug="tech")
parent = BlogIndexPage.objects.get()
works = WorksPage.objects.get()
assert works.live_revision_id == works.latest_revision_id, "Preserve pending Works draft; resolve before publication."
existing = list(works.works.values_list("contact_key", flat=True))
print(f"Validated article ({count} characters), image, Tech category, and Works page.")
print("Existing Works:", existing)
if os.environ.get("PUBLISH") == "1":
    with transaction.atomic():
        works = WorksPage.objects.select_for_update().get(pk=works.pk)
        assert works.live_revision_id == works.latest_revision_id
        Image = get_image_model()
        image = Image.objects.filter(title="Rirekisho Studio — 公開トップページ").first()
        if image is None:
            with open("/tmp/rirekisho-studio-works.png", "rb") as source:
                image = Image(title="Rirekisho Studio — 公開トップページ", file=File(source, name="rirekisho-studio-works.png"))
                image.full_clean()
                image.save()
        post = BlogPostPage.objects.filter(slug=slug).first()
        if post is None:
            post = BlogPostPage(slug=slug, live=False)
            is_new = True
        else:
            assert post.get_parent().pk == parent.pk
            assert post.live_revision_id == post.latest_revision_id, "Preserve pending article draft."
            is_new = False
        post.title = "Rirekisho Studioを公開しました — 履歴書を端末内で作成するWebアプリ"
        post.body = body
        post.category = category
        post.published_at = post.published_at or timezone.now()
        post.meta_description = "履歴書を端末内で作成するRirekisho Studioを公開しました。A4・A3 PDF、同意に基づく端末保存、React・IndexedDB・PWA、専用アイコンとCloudflareでの公開を紹介します。"
        post.search_description = post.meta_description
        post.og_image = image
        post.full_clean(exclude=["path", "depth"] if is_new else None)
        if is_new:
            parent.add_child(instance=post)
        post.save_revision().publish()

        work = works.works.filter(contact_key=key).first()
        if work is None:
            work = WorkItem(page=works, contact_key=key, sort_order=max([w.sort_order or 0 for w in works.works.all()] + [-1]) + 1)
        work.name = "Rirekisho Studio — 履歴書作成"
        work.description = "Rirekisho Studioは、登録不要で日本向けの履歴書を作成できる公式アプリです。A4縦またはA3横のPDFとして保存できます。入力内容は運営者のサーバーへ保存されず、利用者が許可した場合だけ利用中の端末へ保存されます。"
        work.image = image
        work.image_alt = "Rirekisho Studioのトップページ。履歴書を端末内で作成できることと、主要機能を案内している。"
        work.application_url = "https://resume.nuconeko-garden.com/"
        work.kind = WorkItem.Kind.APPLICATION
        work.is_listed = True
        work.related_article = post
        work.full_clean()
        works.works.add(work)
        works.full_clean()
        revision = works.save_revision()
        revision.publish()
        works.refresh_from_db()
        assert set(existing).issubset(set(works.works.values_list("contact_key", flat=True)))
        print(f"Published article ID {post.pk}, Works revision {revision.pk}, image ID {image.pk}.")
else:
    print("Dry run only; no records changed.")
