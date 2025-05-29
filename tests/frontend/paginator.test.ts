import Paginator from "../../frontend/src/components/common/Pagination/paginator";

/**
 * Pagination arithmetic.
 *
 * The launchpad list is server-paginated, and this object decides both the
 * window of page numbers rendered and the "showing x to y of z" line. The
 * edge cases - an empty result set, a page beyond the end, a window wider
 * than the number of pages - are the ones that put NaN or negative numbers
 * on screen, so they get the most attention here.
 */
describe("Paginator", () => {
  describe("defaults", () => {
    it("defaults to 25 per page and a 10-page window", () => {
      const paginator = new Paginator();
      expect(paginator.perPage).toBe(25);
      expect(paginator.length).toBe(10);
    });

    it("can be called without new", () => {
      const paginator = (Paginator as any)(5, 3);
      expect(paginator.perPage).toBe(5);
    });
  });

  describe("a typical middle page", () => {
    const build = new Paginator(10, 5).build(100, 5);

    it("computes the total number of pages", () => {
      expect(build.totalPages).toBe(10);
    });

    it("reports the current page", () => {
      expect(build.currentPage).toBe(5);
    });

    it("centres the window on the current page", () => {
      expect(build.firstPage).toBe(3);
      expect(build.lastPage).toBe(7);
    });

    it("renders exactly the requested window length", () => {
      expect(build.pages).toBe(5);
    });

    it("offers both a previous and a next page", () => {
      expect(build.hasPreviousPage).toBe(true);
      expect(build.hasNextPage).toBe(true);
      expect(build.previousPage).toBe(4);
      expect(build.nextPage).toBe(6);
    });

    it("reports the result range covered by the page", () => {
      expect(build.firstResult).toBe(40);
      expect(build.lastResult).toBe(49);
      expect(build.results).toBe(10);
    });
  });

  describe("the first page", () => {
    const build = new Paginator(10, 5).build(100, 1);

    it("has no previous page", () => {
      expect(build.hasPreviousPage).toBe(false);
    });

    it("starts the window at page one", () => {
      expect(build.firstPage).toBe(1);
    });

    it("starts at the first result", () => {
      expect(build.firstResult).toBe(0);
    });
  });

  describe("the last page", () => {
    const build = new Paginator(10, 5).build(100, 10);

    it("has no next page", () => {
      expect(build.hasNextPage).toBe(false);
    });

    it("ends the window at the last page", () => {
      expect(build.lastPage).toBe(10);
    });

    it("ends at the last result", () => {
      expect(build.lastResult).toBe(99);
    });
  });

  describe("a partial final page", () => {
    const build = new Paginator(10, 5).build(93, 10);

    it("counts the partial page", () => {
      expect(build.totalPages).toBe(10);
    });

    it("stops at the real last result", () => {
      expect(build.lastResult).toBe(92);
      expect(build.results).toBe(3);
    });
  });

  describe("clamping", () => {
    it("clamps a page below one back to the first page", () => {
      expect(new Paginator(10, 5).build(100, -3).currentPage).toBe(1);
    });

    it("clamps a page past the end back to the last page", () => {
      expect(new Paginator(10, 5).build(100, 9999).currentPage).toBe(10);
    });

    it("treats a missing page as page one", () => {
      expect(new Paginator(10, 5).build(100, undefined as any).currentPage).toBe(1);
    });

    it("accepts numeric strings for both arguments", () => {
      const build = new Paginator(10, 5).build("100" as any, "3" as any);
      expect(build.currentPage).toBe(3);
      expect(build.totalPages).toBe(10);
    });
  });

  describe("an empty result set", () => {
    const build = new Paginator(10, 5).build(0, 1);

    it("reports no pages", () => {
      expect(build.totalPages).toBe(0);
    });

    it("never reports a negative result index", () => {
      expect(build.firstResult).toBeGreaterThanOrEqual(0);
      expect(build.lastResult).toBeGreaterThanOrEqual(0);
    });

    it("offers no navigation", () => {
      expect(build.hasNextPage).toBe(false);
      expect(build.hasPreviousPage).toBe(false);
    });

    it("renders no page links", () => {
      expect(build.pages).toBeLessThanOrEqual(0);
    });
  });

  describe("fewer pages than the window", () => {
    const build = new Paginator(10, 10).build(25, 1);

    it("never renders more links than there are pages", () => {
      expect(build.pages).toBe(3);
    });

    it("keeps the window inside the real page range", () => {
      expect(build.firstPage).toBeGreaterThanOrEqual(1);
      expect(build.lastPage).toBeLessThanOrEqual(build.totalPages);
    });
  });

  describe("a single full page", () => {
    const build = new Paginator(6, 5).build(6, 1);

    it("reports one page", () => {
      expect(build.totalPages).toBe(1);
    });

    it("covers every result", () => {
      expect(build.firstResult).toBe(0);
      expect(build.lastResult).toBe(5);
      expect(build.results).toBe(6);
    });
  });

  describe("page-size behaviour matching the API default", () => {
    /** DEFAULT_PAGINATION_SETTING.SIZE on the API is 6. */
    const paginator = new Paginator(6, 5);

    it("splits 20 results into four pages", () => {
      expect(paginator.build(20, 1).totalPages).toBe(4);
    });

    it("puts results 6..11 on page two", () => {
      const build = paginator.build(20, 2);
      expect(build.firstResult).toBe(6);
      expect(build.lastResult).toBe(11);
    });

    it("leaves two results on the final page", () => {
      const build = paginator.build(20, 4);
      expect(build.results).toBe(2);
    });
  });
});
