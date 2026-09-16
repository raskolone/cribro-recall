import React, { useEffect, useRef, useState } from 'react';
import { animateModuleEnter, animateModuleExit } from '../../services/gsapAnimations';

interface GSAPModuleTransitionProps {
  activeKey: string | number;
  children: React.ReactNode;
  className?: string;
}

export const GSAPModuleTransition: React.FC<GSAPModuleTransitionProps> = ({
  activeKey,
  children,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayChildren, setDisplayChildren] = useState(children);
  const [currentKey, setCurrentKey] = useState(activeKey);

  useEffect(() => {
    if (activeKey !== currentKey) {
      // Wyjście starego widoku
      if (containerRef.current) {
        animateModuleExit(containerRef.current, () => {
          setCurrentKey(activeKey);
          setDisplayChildren(children);
        });
      } else {
        setCurrentKey(activeKey);
        setDisplayChildren(children);
      }
    } else {
      setDisplayChildren(children);
    }
  }, [activeKey, children, currentKey]);

  useEffect(() => {
    // Wejście nowego widoku
    if (containerRef.current) {
      animateModuleEnter(containerRef.current);
    }
  }, [currentKey]);

  return (
    <div ref={containerRef} className={className}>
      {displayChildren}
    </div>
  );
};

export default GSAPModuleTransition;
