import { useEffect, useRef, useState } from 'react';
import { Lightbulb, Mic, Globe, Paperclip, Send } from 'lucide-react';
import { AnimatePresence, motion, type Variants } from 'motion/react';

const PLACEHOLDERS = [
  'Спросите что угодно про магазин…',
  'Покажи топ товаров по обороту',
  'Какие позиции залежались?',
  'Сравни закупку и продажу',
  'Сводка по остаткам за июнь',
];

interface AIChatInputProps {
  /** Вызывается при отправке непустого сообщения. */
  onSend: (text: string) => void;
  /** Доп. классы внешнего контейнера (ширина и т.п.). */
  className?: string;
}

/**
 * Анимированное поле ввода для ИИ-чата.
 * Адаптивно: на телефоне сжимается, текст 16px (без авто-зума iOS).
 */
export function AIChatInput({ onSend, className = '' }: AIChatInputProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [thinkActive, setThinkActive] = useState(false);
  const [deepSearchActive, setDeepSearchActive] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Циклическая смена подсказки, пока поле неактивно и пустое.
  useEffect(() => {
    if (isActive || inputValue) return;
    const interval = setInterval(() => {
      setShowPlaceholder(false);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
        setShowPlaceholder(true);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, [isActive, inputValue]);

  // Сворачивание при клике вне поля (если оно пустое).
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        if (!inputValue) setIsActive(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputValue]);

  const handleActivate = () => setIsActive(true);

  function handleSend() {
    const text = inputValue.trim();
    if (!text) return;
    onSend(text);
    setInputValue('');
  }

  const containerVariants: Variants = {
    collapsed: {
      height: 68,
      boxShadow: '0 2px 8px 0 rgba(0,0,0,0.08)',
      transition: { type: 'spring', stiffness: 120, damping: 18 },
    },
    expanded: {
      height: 128,
      boxShadow: '0 8px 32px 0 rgba(0,0,0,0.16)',
      transition: { type: 'spring', stiffness: 120, damping: 18 },
    },
  };

  const placeholderContainerVariants: Variants = {
    initial: {},
    animate: { transition: { staggerChildren: 0.025 } },
    exit: { transition: { staggerChildren: 0.015, staggerDirection: -1 } },
  };

  const letterVariants: Variants = {
    initial: { opacity: 0, filter: 'blur(12px)', y: 10 },
    animate: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: {
        opacity: { duration: 0.25 },
        filter: { duration: 0.4 },
        y: { type: 'spring', stiffness: 80, damping: 20 },
      },
    },
    exit: {
      opacity: 0,
      filter: 'blur(12px)',
      y: -10,
      transition: {
        opacity: { duration: 0.2 },
        filter: { duration: 0.3 },
        y: { type: 'spring', stiffness: 80, damping: 20 },
      },
    },
  };

  return (
    <motion.div
      ref={wrapperRef}
      className={`w-full ${className}`}
      variants={containerVariants}
      animate={isActive || inputValue ? 'expanded' : 'collapsed'}
      initial="collapsed"
      style={{ overflow: 'hidden', borderRadius: 28, background: '#fff' }}
      onClick={handleActivate}
    >
      <div className="flex flex-col items-stretch w-full h-full">
        {/* Строка ввода */}
        <div className="flex items-center gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-full bg-white w-full">
          <button
            className="hidden sm:flex p-3 rounded-full text-[#56616e] hover:bg-gray-100 transition shrink-0"
            title="Прикрепить файл"
            type="button"
            tabIndex={-1}
          >
            <Paperclip size={20} />
          </button>

          {/* Поле ввода и анимированная подсказка */}
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="w-full border-0 outline-0 rounded-md px-3 py-2 text-base bg-transparent font-normal text-[#1a1f25]"
              style={{ position: 'relative', zIndex: 1 }}
              onFocus={handleActivate}
            />
            <div className="absolute left-0 top-0 w-full h-full pointer-events-none flex items-center px-3 py-2">
              <AnimatePresence mode="wait">
                {showPlaceholder && !isActive && !inputValue && (
                  <motion.span
                    key={placeholderIndex}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 select-none pointer-events-none"
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 'calc(100% - 1.5rem)',
                      zIndex: 0,
                    }}
                    variants={placeholderContainerVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    {PLACEHOLDERS[placeholderIndex].split('').map((char, i) => (
                      <motion.span key={i} variants={letterVariants} style={{ display: 'inline-block' }}>
                        {char === ' ' ? ' ' : char}
                      </motion.span>
                    ))}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          <button
            className="p-2.5 sm:p-3 rounded-full text-[#56616e] hover:bg-gray-100 transition shrink-0"
            title="Голосовой ввод"
            type="button"
            tabIndex={-1}
          >
            <Mic size={20} />
          </button>
          <button
            className="flex items-center justify-center bg-[#1f2937] hover:bg-[#111827] text-white p-2.5 sm:p-3 rounded-full font-medium transition-colors shrink-0 disabled:opacity-40"
            title="Отправить"
            type="button"
            disabled={!inputValue.trim()}
            onClick={(e) => {
              e.stopPropagation();
              handleSend();
            }}
          >
            <Send size={18} />
          </button>
        </div>

        {/* Раскрывающиеся переключатели */}
        <motion.div
          className="w-full flex justify-start px-3 sm:px-4 items-center text-sm"
          variants={{
            hidden: { opacity: 0, y: 20, pointerEvents: 'none' as const, transition: { duration: 0.25 } },
            visible: {
              opacity: 1,
              y: 0,
              pointerEvents: 'auto' as const,
              transition: { duration: 0.35, delay: 0.08 },
            },
          }}
          initial="hidden"
          animate={isActive || inputValue ? 'visible' : 'hidden'}
          style={{ marginTop: 8 }}
        >
          <div className="flex gap-2 sm:gap-3 items-center">
            {/* Переключатель «Подумать» */}
            <button
              className={`flex items-center gap-1 px-3 sm:px-4 py-2 rounded-full transition-all font-medium group ${
                thinkActive
                  ? 'bg-blue-600/10 outline outline-blue-600/60 text-blue-950'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Подумать"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setThinkActive((a) => !a);
              }}
            >
              <Lightbulb className="group-hover:fill-yellow-300 transition-all" size={18} />
              Подумать
            </button>

            {/* Переключатель «Глубокий поиск» */}
            <motion.button
              className={`flex items-center px-4 gap-1 py-2 rounded-full transition font-medium whitespace-nowrap overflow-hidden justify-start ${
                deepSearchActive
                  ? 'bg-blue-600/10 outline outline-blue-600/60 text-blue-950'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Глубокий поиск"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeepSearchActive((a) => !a);
              }}
              initial={false}
              animate={{ width: deepSearchActive ? 150 : 36, paddingLeft: deepSearchActive ? 8 : 9 }}
            >
              <div className="flex-1">
                <Globe size={18} />
              </div>
              <motion.span className="pb-[2px]" initial={false} animate={{ opacity: deepSearchActive ? 1 : 0 }}>
                Поиск
              </motion.span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
