import React from "react";
import "./IMessageBubble.less";

interface BubbleLink {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface IMessageBubbleProps {
  links: BubbleLink[];
}

const IMessageBubble: React.FC<IMessageBubbleProps> = ({ links }) => {
  return (
    <div className="imessage-bubble">
      <div className="imessage-bubble__card">
        {links.map((link, index) => (
          <React.Fragment key={index}>
            <button
              onClick={(e) => {
                if (!link.href || link.href === "#") e.preventDefault();
                link.onClick?.();
              }}
              className="imessage-bubble__link"
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
