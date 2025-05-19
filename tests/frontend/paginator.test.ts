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

});
