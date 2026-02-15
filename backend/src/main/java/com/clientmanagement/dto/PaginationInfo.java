package com.clientmanagement.dto;

/**
 * Pagination information for list responses.
 */
public class PaginationInfo {
    public int page;
    public int limit;
    public long total;
    public int totalPages;

    public PaginationInfo() {}

    public PaginationInfo(int page, int limit, long total) {
        this.page = page;
        this.limit = limit;
        this.total = total;
        this.totalPages = (int) Math.ceil((double) total / limit);
    }
}
