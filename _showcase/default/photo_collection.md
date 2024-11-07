---
show: true
width: 4
date: 2021-09-12 00:01:00 +0800
height: 400px
images:
- src: /assets/images/pyramids.jpg
  title: The Pyramids
  desc: Near my home in Egypt.
- src: https://picsum.photos/seed/second22/800/800
  title: Photo 2
  desc: Description 2
---

{% include widgets/carousel.html id=page.id images=page.images height=page.height %}
