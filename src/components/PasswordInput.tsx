import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
  name?: string;
  id?: string;
  required?: boolean;
}

export function PasswordInput({ value, onChange, placeholder, className = "field", ...rest }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        {...rest}
        type={show ? "text" : "password"}
        className={className + " pr-11"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Скрыть пароль" : "Показать пароль"}
        title={show ? "Скрыть пароль" : "Показать пароль"}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center text-ink-mute hover:text-ink hover:bg-line-soft transition-colors cursor-pointer"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
