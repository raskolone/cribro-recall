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
  const latestChildrenRef = useRef(children);
  latestChildrenRef.current = children;

  const [displayChildren, setDisplayChildren] = useState(children);
  const [currentKey, setCurrentKey] = useState(activeKey);
  const isTransitioningRef = useRef(false);
  const targetKeyRef = useRef(activeKey);

  useEffect(() => {
    targetKeyRef.current = activeKey;

    if (activeKey === currentKey) {
      setDisplayChildren(children);
      return;
    }

    if (isTransitioningRef.current) {
      return;
    }

    isTransitioningRef.current = true;

    if (containerRef.current) {
      animateModuleExit(containerRef.current, () => {
        const nextKey = targetKeyRef.current;
        setCurrentKey(nextKey);
        setDisplayChildren(latestChildrenRef.current);
        isTransitioningRef.current = false;
      });
    } else {
      setCurrentKey(activeKey);
      setDisplayChildren(children);
      isTransitioningRef.current = false;
    }
  }, [activeKey, currentKey, children]);

  useEffect(() => {
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

