"use client";

import "./iphone-preview.css";

type PhonePreviewProps = {
  mediaUrl?: string | null;
  caption?: string;
  commentText?: string;
  username?: string;
  profilePictureUrl?: string | null;
  tab?: "post" | "comment" | "dm";
  onTabChange?: (tab: "post" | "comment" | "dm") => void;
  welcomeText?: string;
  welcomeButton?: string;
  followText?: string;
  followButton?: string;
  showFollowConfirmed?: boolean;
  followerHandle?: string;
  emailText?: string;
  emailPreview?: string;
  rewardText?: string;
  rewardButton?: string;
  reminderText?: string;
  reminderMinutes?: number;
  showReward?: boolean;
};

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function SignalIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
      <rect x="0" y="8" width="3" height="4" rx="0.5" fill="currentColor" />
      <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="currentColor" />
      <rect x="9" y="2" width="3" height="10" rx="0.5" fill="currentColor" />
      <rect
        x="13.5"
        y="0"
        width="2.5"
        height="12"
        rx="0.5"
        fill="currentColor"
        opacity="0.35"
      />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg width="22" height="12" viewBox="0 0 22 12" fill="none" aria-hidden>
      <rect
        x="0.5"
        y="0.5"
        width="18"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeOpacity="0.4"
      />
      <rect x="2" y="2" width="14" height="8" rx="1" fill="currentColor" />
      <path
        d="M19.5 4v4a1.5 1.5 0 0 0 0-4z"
        fill="currentColor"
        opacity="0.4"
      />
    </svg>
  );
}

export function PhonePreview({
  mediaUrl,
  caption = "Sua publicação",
  commentText = "Eu quero",
  username = "seu_perfil",
  profilePictureUrl,
  tab = "comment",
  onTabChange,
  welcomeText = "Olá! Obrigado pelo interesse 😊",
  welcomeButton = "Me envie o link",
  followText = "",
  followButton = "Já sigo",
  showFollowConfirmed = false,
  followerHandle = "seguidor",
  emailText = "",
  emailPreview = "follower@gmail.com",
  rewardText = "Aqui está o seu acesso",
  rewardButton = "Acessar",
  reminderText = "",
  reminderMinutes = 30,
  showReward = true,
}: PhonePreviewProps) {
  const welcomeParts = welcomeText ? splitParagraphs(welcomeText) : [];
  const followParts = followText ? splitParagraphs(followText) : [];
  const emailParts = emailText ? splitParagraphs(emailText) : [];
  const rewardParts = rewardText ? splitParagraphs(rewardText) : [];
  const reminderParts = reminderText ? splitParagraphs(reminderText) : [];
  const handle = username.replace(/^@/, "");

  return (
    <div className="symbius-iphone-wrap">
      <div className="symbius-iphone-scale">
        <div className="iphone-container">
          <div className="iphone-screen">
            <div className="top-bar">
              <span className="time">9:41</span>
              <div className="island" />
              <div className="status-icons">
                <SignalIcon />
                <BatteryIcon />
              </div>
            </div>

            <div className="chat-header">
              <div
                className="profile-pic"
                style={
                  profilePictureUrl
                    ? { backgroundImage: `url(${profilePictureUrl})` }
                    : undefined
                }
              />
              <div className="profile-info">
                <span className="username">@{handle}</span>
                <span className="subtitle">
                  {tab === "dm" ? "Direct" : "Instagram"}
                </span>
              </div>
            </div>

            <div className="chat-body">
              {(tab === "post" || tab === "comment") && (
                <>
                  <div className="feed-media">
                    {mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl} alt="" />
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          height: "100%",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#737373",
                          fontSize: 13,
                        }}
                      >
                        Publicação
                      </div>
                    )}
                  </div>
                  <p className="feed-caption">
                    <strong>@{handle}</strong> {caption}
                  </p>
                  {tab === "comment" && (
                    <div className="comment-card">
                      <div className="label">Comentário</div>
                      <div className="body">
                        <span className="handle">@seguidor</span>{" "}
                        {commentText || "…"}
                      </div>
                    </div>
                  )}
                </>
              )}

              {tab === "dm" && (
                <>
                  <div className="direct-label">DIRECT</div>

                  {welcomeParts.length > 0 && (
                    <div className="msg bubble-received">
                      {welcomeParts.map((p, i) => (
                        <p key={`w-${i}`}>{p}</p>
                      ))}
                    </div>
                  )}

                  {welcomeButton ? (
                    <div className="btn-action" role="presentation">
                      {welcomeButton}
                    </div>
                  ) : null}

                  {welcomeButton ? (
                    <div className="msg bubble-sent">{welcomeButton}</div>
                  ) : null}

                  {followParts.length > 0 && (
                    <div className="msg bubble-received">
                      {followParts.map((p, i) => (
                        <p key={`f-${i}`}>{p}</p>
                      ))}
                    </div>
                  )}
                  {followButton ? (
                    <div className="btn-action" role="presentation">
                      {followButton}
                    </div>
                  ) : null}
                  {followButton ? (
                    <div className="msg bubble-sent">{followButton}</div>
                  ) : null}

                  {showFollowConfirmed && followParts.length > 0 && (
                    <div className="system-event">
                      <strong>{followerHandle.replace(/^@/, "")}</strong>{" "}
                      começou a seguir você. · agora
                    </div>
                  )}

                  {emailParts.length > 0 && (
                    <div className="msg bubble-received">
                      {emailParts.map((p, i) => (
                        <p key={`e-${i}`}>{p}</p>
                      ))}
                    </div>
                  )}
                  {emailParts.length > 0 && (
                    <div className="msg bubble-sent">{emailPreview}</div>
                  )}

                  {showReward && rewardParts.length > 0 && (
                    <div className="msg bubble-received">
                      {rewardParts.map((p, i) => (
                        <p key={`r-${i}`}>{p}</p>
                      ))}
                    </div>
                  )}

                  {showReward && rewardButton ? (
                    <div className="btn-link" role="presentation">
                      {rewardButton}
                    </div>
                  ) : null}

                  {reminderParts.length > 0 && (
                    <>
                      <div className="system-event">
                        {reminderMinutes} minutos depois
                      </div>
                      <div className="msg bubble-received opacity-80">
                        {reminderParts.map((p, i) => (
                          <p key={`m-${i}`}>{p}</p>
                        ))}
                      </div>
                      {rewardButton ? (
                        <div className="btn-link opacity-80" role="presentation">
                          {rewardButton}
                        </div>
                      ) : null}
                    </>
                  )}
                </>
              )}
            </div>

            <div className="home-indicator-bar">
              <div className="home-indicator" />
            </div>
          </div>
        </div>
      </div>

      <div className="symbius-iphone-tabs">
        {(
          [
            ["post", "Publicar"],
            ["comment", "Comentários"],
            ["dm", "DM"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange?.(id)}
            className={tab === id ? "active" : undefined}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
