const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const targetStr = `  const markdownComponents = {
    p: ({ children, ...props }: any) => {
      let isEventCard = false;
      let eventId = null;
      
      React.Children.forEach(children, (child: any) => {
        if (React.isValidElement(child) && (child.props as any).href?.startsWith('#DETAILS::')) {
           isEventCard = true;
           eventId = (child.props as any).href.split('::')[1];
        }
        if (React.isValidElement(child) && (child.type === 'strong' || child.type === 'b')) {
           React.Children.forEach((child.props as any).children, (grandchild: any) => {
             if (React.isValidElement(grandchild) && grand(child.props as any).href?.startsWith('#DETAILS::')) {
               isEventCard = true;
               eventId = grand(child.props as any).href.split('::')[1];
             }
           });
        }
      });

      if (isEventCard && eventId) {
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            drag="x"
            dragConstraints={{ left: -100, right: 0 }}
            dragElastic={{ left: 0.2, right: 0 }}
            onDragEnd={(e, info) => {
              if (info.offset.x < -30 || info.velocity.x < -100) {
                handleSelectEventById(eventId as string);
              }
            }}
            onClick={(e) => { e.stopPropagation(); handleSelectEventById(eventId as string); }}
            className="my-1 p-3 -mx-3 relative group select-none touch-pan-y text-left cursor-pointer w-full rounded-xl transition-all duration-200 hover:bg-slate-100/60 flex flex-row items-center justify-between"
          >
            <div className="flex-1 pr-4 overflow-hidden text-slate-700 whitespace-pre-wrap text-[15px] leading-relaxed">
              {children}
            </div>
            
            <div className="flex-shrink-0 text-slate-400 group-hover:text-blue-500 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:translate-x-1 duration-200 pointer-events-none">
              <span className="text-[10px] font-bold tracking-wider mr-1 uppercase hidden md:inline-block pointer-events-none">Swipe / Click</span>
              <ChevronRight className="w-5 h-5" />
            </div>
          </motion.div>
        );
      }

      return <p className="mb-2 last:mb-0 leading-relaxed" {...props}>{children}</p>;
    },
    a: ({ href, children, ...props }: any) => {
      if (href?.startsWith("#DETAILS::")) {
        return (
          <span
            className="text-blue-600 group-hover:text-blue-800 transition-colors font-semibold text-left mb-1 underline inline-block"
            {...props}
          >
            {children}
          </span>
        );
      }
      // Preserve custom styled links (like those inside event cards)
      if (props.style || href?.startsWith("/event/")) {
        return (
          <a
            href={href}
            className="text-emerald-700 font-semibold hover:underline"
            {...props}
          >
            {children}
          </a>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 transition-colors underline"
          {...props}
        >
          {children}
        </a>
      );
    }
  };`;

const replacementStr = `  const markdownComponents = {
    p: ({ children, ...props }: any) => {
      return <p className="mb-2 last:mb-0 leading-relaxed" {...props}>{children}</p>;
    },
    a: ({ href, children, ...props }: any) => {
      if (href?.startsWith("#DETAILS::")) {
        const eventId = href.split("::")[1];
        
        // If it's a full styled card from the backend
        if (props.style && Object.keys(props.style).length > 0) {
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              drag="x"
              dragConstraints={{ left: -100, right: 0 }}
              dragElastic={{ left: 0.2, right: 0 }}
              onDragEnd={(e, info) => {
                if (info.offset.x < -30 || info.velocity.x < -100) {
                  handleSelectEventById(eventId as string);
                }
              }}
              onClick={(e) => { 
                  e.preventDefault(); e.stopPropagation(); 
                  handleSelectEventById(eventId as string); 
              }}
              className="my-3 -mx-2 relative group select-none touch-pan-y text-left cursor-pointer rounded-xl transition-all duration-200 block"
            >
              <div 
                className="w-full flex flex-col bg-white border border-slate-200 group-hover:border-blue-300 group-hover:shadow-md rounded-xl p-4 transition-all overflow-hidden relative"
              >
                <div className="flex-1 pr-8 overflow-hidden text-slate-700 whitespace-pre-wrap text-[15px] leading-relaxed">
                   {children}
                </div>
                
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:translate-x-1 duration-200 pointer-events-none bg-gradient-to-l from-white via-white pl-4">
                  <span className="text-[10px] font-bold tracking-wider mr-1 uppercase hidden md:inline-block">Swipe / Click</span>
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </motion.div>
          );
        }

        // Just an inline text link
        return (
          <span
            className="text-blue-600 group-hover:text-blue-800 transition-colors font-semibold text-left mb-1 underline inline-block cursor-pointer"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSelectEventById(eventId as string); }}
          >
            {children}
          </span>
        );
      }
      
      // Preserve custom styled links
      if (props.style || href?.startsWith("/event/")) {
        return (
          <a
            href={href}
            className="text-emerald-700 font-semibold hover:underline"
            {...props}
          >
            {children}
          </a>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 transition-colors underline"
          {...props}
        >
          {children}
        </a>
      );
    }
  };`;

// Use regex matching if exact match fails
if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync('src/App.tsx', content);
    console.log("Success exact");
} else {
    // Try to regex replace
    const regex = /const markdownComponents = \{[\s\S]*?    \}\n  \};/m;
    if (regex.test(content)) {
        content = content.replace(regex, replacementStr);
        fs.writeFileSync('src/App.tsx', content);
        console.log("Success regex");
    } else {
        console.log("Not found regex either");
    }
}
