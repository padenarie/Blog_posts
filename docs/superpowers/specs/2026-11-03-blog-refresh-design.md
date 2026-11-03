# Personal Blog Refresh — Design

**Date:** 2026-11-03
**Status:** Approved in conversation; awaiting written-spec review

## Purpose and scope

Refresh the existing personal blog for AI builders and professional peers. A first-time visitor should quickly understand Pierre-Antoine Denarié's engineering perspective, explore a real piece of work, and find his writing. Preserve the existing static-site architecture and the dark, cyan, tensor-based identity while making the presentation more expressive.

This specification covers the visual system, home page, and About page. Visitor analytics is a separate subproject. The Token Economy article and its claims will be designed and written later.

## Approach

Use the **tensor editorial** direction. The alternatives considered were:

| Direction | Benefit | Cost |
| --- | --- | --- |
| Tensor editorial | Stronger hierarchy and a more distinctive home page while preserving the existing visual identity | Changes home-page markup and layout |
| Precision instrument | Small, low-risk refinements to the current centered design | Less visible improvement |
| Luminous field | More atmospheric visual impact | Greater contrast and performance risk |

The selected direction keeps the dark base, cyan accent, monospace details, coordinate grid, and interactive tensor. It uses a wider presentation area on the home page and a narrower reading column for articles and About text.

## Home page

The page has four sections in order:

1. **Hero:** Pierre-Antoine's name and the statement “Making complex systems tangible.” Supporting copy identifies his current AI consulting work and Systems and Control background without claiming outcomes from the future Token Economy article. The primary action leads to the work below; a secondary path leads to About.
2. **Featured work:** A prominent card for [The Cocktail Party Problem](https://huggingface.co/spaces/Padenarie/The_Cocktail_Party_Problem), his interactive demonstration of a tensor-based blind source separation algorithm. Explain what visitors can try in plain language and link to a dedicated `/demo.html` page. The card also offers a direct Hugging Face link. The Space may take a moment to start.
3. **Writing:** Show genuine posts from the existing Markdown collection, newest first. Move the current “Hello, world” scaffold from `content/posts/` to `content/drafts/` so it is preserved but not published. Until there is a real article, show a brief, honest empty state; do not invent a published post or feature the unwritten Token Economy article as one.
4. **About preview:** A short introduction that links to the full About page.

Once the Token Economy article exists and is published, it can become the featured article through the normal post list. This refresh does not create that article.

## Interactive demo page

Render a dedicated, responsive `/demo.html` page with a short introduction, a prominent **Launch interactive demo** button, a startup-delay note, and a direct **Open on Hugging Face** fallback link. On button activation, insert an iframe whose source is the direct `https://padenarie-the-cocktail-party-problem.hf.space/` app. Give the frame a descriptive title and enough height for the Gradio interface. Do not load the frame before activation. If the external app fails to load, the link remains available; do not make the blog's own page delivery depend on the Space. The demo's microphone feature may request browser permission.

Hugging Face currently embeds this running Space in an iframe on its own page, and the direct app responded successfully when checked. Test embedding from the actual blog origin during implementation, since Hugging Face can change framing policy. The iframe requests and algorithm computation run through Hugging Face, not the Hetzner blog server. The Hetzner server only serves the static page and its small launch script. Do not proxy Gradio requests through nginx or deploy the algorithm on Hetzner.

## About page

Write a concise personal narrative in Pierre-Antoine's voice, using his LinkedIn profile as source material rather than reproducing its CV structure. The arc is:

1. Engineering motivation and TU Delft education, including the cum laude master's degree in Systems and Control.
2. Tensor, optimization, and control interests, including the independent component analysis work behind the featured demo.
3. Practical data tooling experience and current AI Consultant role at Deloitte.
4. Current interest in local AI and learning through building, stated without unverified claims about Token Economy results.
5. A brief personal detail about karate, drawn from the profile, to give the page warmth without dominating it.

The LinkedIn summary still describes an earlier SAP-focused role; use the current profile headline and experience timeline for the present role. Avoid employer-sensitive project details. Include a link to the public LinkedIn profile. The home-page introduction and About page should agree on role and scope.

## Visual and interaction design

- Expand the home-page presentation canvas while keeping prose around 65–72 characters wide. Use an oversized, left-aligned two-line hero and a clearer section hierarchy.
- Concentrate the existing tensor visual beside the hero on wide screens. Provide a calm background behind text. Cyan is the primary highlight; pink is occasional.
- Give the ICA feature distinct prominence. Use deliberate spacing, fine rules, and restrained hover transitions. Avoid decorative labels or motion that obscure content.
- Stack the hero and feature on narrow screens. Keep links and controls usable by touch and keyboard.
- Preserve dark and light themes, visible focus, sufficient text contrast, and the existing reduced-motion behavior. In particular, use a darker cyan for normal text in the light theme if needed for contrast.
- Keep article pages visually quieter than the home page so long-form reading remains comfortable.

## Implementation boundaries and data flow

- Existing `content/site.json` supplies short site-level copy; `content/about.md` supplies the About narrative; `content/posts/*.md` supplies the writing list.
- `src/build.mjs` renders the home, About, and demo HTML using the existing layout. CSS, the existing tensor script, and a small demo-launch script provide presentation. The build still outputs static files to `dist/`; the current Dockerfile and nginx serve them.
- Store the featured work's title, description, Hugging Face URL, direct embed URL, and wake-up note together in `content/site.json`, so they can be updated without editing rendering logic. Validate both URLs as HTTPS and restrict the embed host to `hf.space`.
- Missing required content or malformed configuration must fail the build clearly. A sleeping or unavailable Hugging Face Space does not break the blog; the external link remains a normal link.
- No frontend framework, CMS, runtime API, database, or new blog service is introduced by this subproject.

## Verification

- Run the existing test suite and production build. Check the generated home, About, and demo pages for correct copy and links, and confirm the sample post is absent from the public writing list.
- Inspect the home, About, demo, and article layouts at narrow and wide viewport widths in both themes.
- Check keyboard navigation, focus visibility, contrast, and reduced-motion behavior. Confirm the ICA feature opens `/demo.html`, the frame loads only after activation, the direct Hugging Face fallback works, and the possible wake-up delay is clear. Verify the frame from the deployed blog origin and confirm demo requests do not pass through Hetzner.

## Deferred work

- Visitor analytics, including visits, page views, referrers, and reading depth, receives a separate design and deployment decision.
- The Token Economy article receives its own content and evidence review. Its dashboard data contains documented measurement and pricing caveats, so no numerical claims are imported into this refresh.
