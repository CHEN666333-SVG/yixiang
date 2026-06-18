package com.tongji.stock.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Mapper
public interface PostStockMapper {

    /** 批量插入关联（忽略已存在的）。 */
    int batchInsert(@Param("list") List<Map<String, Object>> rows);

    /** 删除某帖子的全部关联（覆盖式同步前清理）。 */
    int deleteByPostId(@Param("postId") Long postId);

    /** 查询某帖子关联的股票列表。 */
    List<Map<String, Object>> listByPostId(@Param("postId") Long postId);

    /** 某股票关联的帖子 id 列表（游标分页，按帖子创建时间倒序）。 */
    List<Map<String, Object>> listPostsByStock(@Param("stockCode") String stockCode,
                                                @Param("createTime") Instant createTime,
                                                @Param("id") Long id,
                                                @Param("size") int size);

    /** 某股票关联的帖子总数。 */
    long countPostsByStock(@Param("stockCode") String stockCode);
}
