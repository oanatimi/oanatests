package com.clientmanagement.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import io.smallrye.config.WithName;

/**
 * Queue configuration properties.
 */
@ConfigMapping(prefix = "queue")
public interface QueueConfig {

    @WithName("process-interval-seconds")
    @WithDefault("5")
    int processIntervalSeconds();

    @WithName("batch-size")
    @WithDefault("10")
    int batchSize();
}
