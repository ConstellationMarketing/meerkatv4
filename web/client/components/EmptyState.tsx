interface EmptyStateProps {
  onCreateNew: () => void;
}

export function EmptyState({ onCreateNew }: EmptyStateProps) {
  return (
    <div
      className="h-full w-full bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "url('https://cdn.builder.io/o/assets%2Fc8a7b33c1f3e4309983e45cabed92535%2Faec1c24c76a84d8a85f8acdaa70558ed?alt=media&token=ab286ea8-ed07-41b7-9dcc-743f827d092f&apiKey=c8a7b33c1f3e4309983e45cabed92535')",
      }}
    />
  );
}
