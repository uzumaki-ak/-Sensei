import sys


def log(message):
    print(message, file=sys.stderr)


async def handle_linkedin(page):
    """
    LinkedIn public job handler.
    """
    log("[HANDLER] LinkedIn")

    await page.wait_for_selector(".top-card-layout, .base-card, .jobs-search__job-details", timeout=15000)

    data = await page.evaluate(
        """() => {
            const getText = (selectors) => {
                for (const selector of selectors) {
                    const el = document.querySelector(selector);
                    if (el && el.innerText.trim()) return el.innerText.trim();
                }
                return null;
            };

            return {
                title: getText([".top-card-layout__title", ".base-search-card__title", "h1"]),
                company: getText([".topcard__org-name-link", ".topcard__flavor", ".base-search-card__subtitle a"]),
                description: getText([".description__text", ".show-more-less-html__markup", ".jobs-description-content__text"]),
                techStack: [],
                recruiterEmail: null
            };
        }"""
    )
    return data


async def handle_internshala(page):
    """
    Internshala job handler.
    """
    log("[HANDLER] Internshala")

    try:
        await page.wait_for_selector(".internship_meta, .profile, .company_name", timeout=10000)
    except Exception:
        log("[HANDLER] Internshala primary selectors not found, fallback extraction will run")

    data = await page.evaluate(
        """() => {
            const getText = (selectors) => {
                for (const selector of selectors) {
                    const el = document.querySelector(selector);
                    if (el && el.innerText.trim()) return el.innerText.trim();
                }
                return null;
            };

            return {
                title: getText([".profile", ".job-title", "h1"]),
                company: getText([".company_name", ".company-name", ".heading_6"]),
                description: getText([".job-description-container", ".internship_details", ".text-container", "#details-container"]),
                techStack: [],
                recruiterEmail: null
            };
        }"""
    )
    return data


async def handle_indeed(page):
    """
    Indeed job handler.
    """
    log("[HANDLER] Indeed")
    await page.wait_for_selector("#jobDescriptionText, [data-testid='jobsearch-JobComponent']", timeout=15000)

    data = await page.evaluate(
        """() => {
            const getText = (selectors) => {
                for (const selector of selectors) {
                    const el = document.querySelector(selector);
                    if (el && el.innerText.trim()) return el.innerText.trim();
                }
                return null;
            };

            return {
                title: getText([".jobsearch-JobInfoHeader-title", "[data-testid='jobsearch-JobInfoHeader-title']", "h1"]),
                company: getText(["[data-company-name='true']", "[data-testid='inlineHeader-companyName']", ".jobsearch-CompanyInfoWithoutHeaderImage"]),
                description: getText(["#jobDescriptionText", "[data-testid='jobsearch-JobComponent-description']"]),
                techStack: [],
                recruiterEmail: null
            };
        }"""
    )
    return data


async def handle_x(page):
    """
    X/Twitter job-post handler.
    """
    log("[HANDLER] X")
    await page.wait_for_selector("[data-testid='tweetText']", timeout=15000)

    data = await page.evaluate(
        """() => {
            const getText = (selector) => document.querySelector(selector)?.innerText.trim() || null;
            return {
                title: "Job post from X",
                company: getText("[data-testid='User-Name']"),
                description: getText("[data-testid='tweetText']"),
                techStack: [],
                recruiterEmail: null
            };
        }"""
    )
    return data


SITE_HANDLERS = {
    "linkedin.com": handle_linkedin,
    "internshala.com": handle_internshala,
    "indeed.com": handle_indeed,
    "x.com": handle_x,
    "twitter.com": handle_x,
}


def get_handler(url):
    for domain, handler in SITE_HANDLERS.items():
        if domain in url:
            return handler
    return None
