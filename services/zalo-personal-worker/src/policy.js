import { ThreadType } from "zca-js";

export function normalizeText(value) {
  return String(value || "").trim();
}

export function stripMentionPrefix(text, displayName) {
  const cleanText = normalizeText(text);
  const cleanName = normalizeText(displayName);
  if (!cleanText || !cleanName) return cleanText;

  const prefix = `@${cleanName}`;
  if (cleanText.toLowerCase().startsWith(prefix.toLowerCase())) {
    return cleanText.slice(prefix.length).replace(/^[\s,;:.]+/, "");
  }
  return cleanText;
}

export function hasMention(text, displayName) {
  const cleanText = normalizeText(text).toLowerCase();
  const cleanName = normalizeText(displayName).toLowerCase();
  return Boolean(cleanText && cleanName && cleanText.includes(`@${cleanName}`));
}

export function shouldAcceptMessage(message, status, options = {}) {
  if (!message || message.isSelf) {
    return { accept: false, reason: "self_or_empty" };
  }

  const text = normalizeText(message.data?.content);
  if (!text) {
    return { accept: false, reason: "non_text" };
  }

  const isGroup = message.type === ThreadType.Group;
  if (!isGroup) {
    return { accept: true, text, isGroup: false };
  }

  const whitelist = new Set(options.threadWhitelist || []);
  const displayName = status?.name || options.displayName || "";
  const mentioned = hasMention(text, displayName);
  const whitelisted = whitelist.has(String(message.threadId));
  const policy = options.replyPolicy || "mention_only";

  if (policy === "all" || mentioned || whitelisted) {
    return {
      accept: true,
      text: mentioned ? stripMentionPrefix(text, displayName) : text,
      isGroup: true,
    };
  }

  return { accept: false, reason: "group_not_mentioned" };
}
