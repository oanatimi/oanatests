package com.clientmanagement.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import io.smallrye.config.WithName;

/**
 * Excel import configuration properties.
 */
@ConfigMapping(prefix = "excel")
public interface ExcelConfig {

    @WithName("data-directory")
    @WithDefault("./data")
    String dataDirectory();
}
