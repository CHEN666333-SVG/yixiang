-- 帖子关联个股表（F1 个股聚合数据底座）
-- 一篇帖子可关联多只股票，一只股票可被多篇帖子关联。
CREATE TABLE IF NOT EXISTS post_stocks (
    id          BIGINT      NOT NULL COMMENT 'Snowflake 主键',
    post_id     BIGINT      NOT NULL COMMENT '关联帖子 id',
    stock_code  VARCHAR(16) NOT NULL COMMENT '股票代码，如 sh600000',
    stock_name  VARCHAR(64)          COMMENT '冗余股票名，避免二次查询',
    create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_post_stock (post_id, stock_code),
    KEY idx_stock_code (stock_code),
    KEY idx_post_id (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='帖子关联个股';
