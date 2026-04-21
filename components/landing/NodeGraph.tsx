import React, { useEffect, useRef } from 'react';

interface NodeGraphProps {
  fullScreen?: boolean;
}

const NodeGraph: React.FC<NodeGraphProps> = ({ fullScreen = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let nodes: { x: number; y: number; vx: number; vy: number }[] = [];

    const resize = () => {
      canvas.width = fullScreen ? window.innerWidth : window.innerWidth * 0.5;
      canvas.height = fullScreen ? window.innerHeight : window.innerHeight * 0.8;
      initNodes();
    };

    const initNodes = () => {
      nodes = [];
      const numNodes = Math.floor((canvas.width * canvas.height) / 15000);
      for (let i = 0; i < numNodes; i++) {
        nodes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update positions
      nodes.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
      });

      // Draw lines
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            // Gold color #c9a86c with opacity based on distance
            ctx.strokeStyle = `rgba(201, 168, 108, ${0.3 * (1 - dist / 150)})`;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(201, 168, 108, 0.5)';
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resize);
    resize();
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [fullScreen]);

  return (
    <canvas
      ref={canvasRef}
      className={`${fullScreen ? 'fixed inset-0' : 'absolute top-0 right-0'} pointer-events-none z-0 opacity-40`}
      style={fullScreen ? { width: '100vw', height: '100vh' } : { width: '50vw', height: '80vh' }}
    />
  );
};

export default NodeGraph;
