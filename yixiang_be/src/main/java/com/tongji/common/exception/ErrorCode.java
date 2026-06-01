package com.tongji.common.exception;

import lombok.Getter;

@Getter
public enum ErrorCode {
    IDENTIFIER_EXISTS("IDENTIFIER_EXISTS", "账号已存在"),
    IDENTIFIER_NOT_FOUND("IDENTIFIER_NOT_FOUND", "账号不存在"),
    ZGID_EXISTS("ZGID_EXISTS", "颐享号已存在"),
    VERIFICATION_RATE_LIMIT("VERIFICATION_RATE_LIMIT", "验证码发送过于频繁"),
    VERIFICATION_DAILY_LIMIT("VERIFICATION_DAILY_LIMIT", "验证码发送次数超限"),
    VERIFICATION_NOT_FOUND("VERIFICATION_NOT_FOUND", "验证码不存在或已过期"),
    VERIFICATION_MISMATCH("VERIFICATION_MISMATCH", "验证码错误"),
    VERIFICATION_TOO_MANY_ATTEMPTS("VERIFICATION_TOO_MANY_ATTEMPTS", "验证码尝试次数过多"),
    INVALID_CREDENTIALS("INVALID_CREDENTIALS", "登录凭证错误"),
    LOGIN_LOCKED("LOGIN_LOCKED", "密码错误次数过多，请15分钟后再试"),
    PASSWORD_POLICY_VIOLATION("PASSWORD_POLICY_VIOLATION", "密码强度不足"),
    TERMS_NOT_ACCEPTED("TERMS_NOT_ACCEPTED", "请先同意服务条款"),
    REFRESH_TOKEN_INVALID("REFRESH_TOKEN_INVALID", "刷新令牌无效"),
    BAD_REQUEST("BAD_REQUEST", "请求参数错误"),
    INTERNAL_ERROR("INTERNAL_ERROR", "服务器内部错误"),
    FORBIDDEN("FORBIDDEN", "无操作权限"),
    CIRCLE_NOT_FOUND("CIRCLE_NOT_FOUND", "圈子不存在"),
    NOT_CIRCLE_MEMBER("NOT_CIRCLE_MEMBER", "需要先加入圈子"),
    ALREADY_CIRCLE_MEMBER("ALREADY_CIRCLE_MEMBER", "已经是圈子成员"),
    TOPIC_NOT_FOUND("TOPIC_NOT_FOUND", "话题不存在"),
    DRAFT_NOT_FOUND("DRAFT_NOT_FOUND", "草稿不存在"),
    DRAFT_FORBIDDEN("DRAFT_FORBIDDEN", "无权操作该草稿"),
    DRAFT_PUBLISH_INVALID("DRAFT_PUBLISH_INVALID", "草稿信息不完整,无法发布"),
    SETTINGS_INVALID_PAYLOAD("SETTINGS_INVALID_PAYLOAD", "设置项格式错误"),
    HOT_PERIOD_INVALID("HOT_PERIOD_INVALID", "热门时间窗口参数错误"),
    RECOMMEND_TYPE_INVALID("RECOMMEND_TYPE_INVALID", "推荐类型错误");

    private final String code;
    private final String defaultMessage;

    ErrorCode(String code, String defaultMessage) {
        this.code = code;
        this.defaultMessage = defaultMessage;
    }
}

