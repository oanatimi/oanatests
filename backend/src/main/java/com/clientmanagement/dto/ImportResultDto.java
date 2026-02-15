package com.clientmanagement.dto;

import java.util.List;

/**
 * Response DTO for Excel import results.
 */
public class ImportResultDto {
    public int filesProcessed;
    public int imported;
    public int skipped;
    public List<String> errors;
    public List<String> logs;
}
