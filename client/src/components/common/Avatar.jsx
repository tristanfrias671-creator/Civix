import React, { useEffect, useState } from 'react';
import { mediaUrl } from '../../utils/mediaUrl';

// A person's profile photo, or the first letter of their name when there is no
// photo or it can't be loaded (for example a file lost when the site was redeployed).
export default function Avatar({ user, src, className = 'w-9 h-9', imgClassName = '', letterClassName = 'text-sm', style }) {
  const url = src || (user?.avatar ? mediaUrl(user.avatar) : '');
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  if (url && !failed) {
    return <img src={url} alt="" onError={() => setFailed(true)} className={`${className} rounded-full object-cover flex-shrink-0 ${imgClassName}`} style={style} />;
  }
  return (
    <div className={`${className} rounded-full text-white flex items-center justify-center font-semibold flex-shrink-0 ${letterClassName}`}
      style={{ background: '#2563eb', ...style }} aria-hidden="true">
      {user?.fullName?.[0]?.toUpperCase()}
    </div>
  );
}
