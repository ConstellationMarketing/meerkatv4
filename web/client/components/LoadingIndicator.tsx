interface LoadingIndicatorProps {
  title?: string;
  description?: string;
  message?: string;
}

export function LoadingIndicator({
  title = "Generating Article",
  description = "Meerkat is creating your article content. This typically takes 1-3 minutes. You'll see the article appear here as soon as it's ready.",
  message,
}: LoadingIndicatorProps) {
  return (
    <div className="w-full h-full bg-background flex flex-col items-center justify-center px-6">
      <style>{`
        @keyframes slowSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .slow-spin {
          animation: slowSpin 4s linear infinite;
        }
      `}</style>
      {/* Tumbling Meerkat */}
      <img
        src="https://cdn.builder.io/api/v1/image/assets%2Fc8a7b33c1f3e4309983e45cabed92535%2Fbc32995655f844b3a380e989d75b017d?format=webp&width=800"
        alt="Meerkat"
        className="mb-8 w-32 h-32 rounded-full object-cover slow-spin"
      />

      {/* Title */}
      <h3 className="text-2xl font-semibold text-foreground mb-3">{title}</h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {description}
      </p>

      {/* Additional message if provided */}
      {message && (
        <p className="text-xs text-muted-foreground mt-4 italic">{message}</p>
      )}
    </div>
  );
}
