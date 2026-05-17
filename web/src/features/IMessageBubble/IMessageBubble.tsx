import React from "react";
import "./IMessageBubble.less";

interface BubbleLink {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface IMessageBubbleProps {
  links: BubbleLink[];
  isSender?: boolean; // 是否为发送方（发送方小尾巴在右边）
}

const IMessageBubble: React.FC<IMessageBubbleProps> = ({
  links,
  isSender = false,
}) => {
  return (
    <div
      className={`imessage-bubble ${isSender ? "imessage-bubble--sender" : ""}`}
    >
      <div
        className={`imessage-bubble__card ${isSender ? "imessage-bubble__card--sender" : ""}`}
      >
        {links.map((link, index) => (
          <React.Fragment key={index}>
            <button
              onClick={(e) => {
                if (!link.href || link.href === "#") e.preventDefault();
                link.onClick?.();
              }}
              className={`imessage-bubble__link ${isSender ? "imessage-bubble__link--sender" : ""}`}
            >
              {link.label}
            </button>
            {index < links.length - 1 && (
              <div className="imessage-bubble__separator" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default IMessageBubble;
