(function() {
  // 1. Inject Styles
  const style = document.createElement('style');
  style.innerHTML = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    #preloader {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #141414;
      z-index: 9999;
      transition: opacity 0.4s ease;
    }
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100px;
      height: 100px;
      gap: 6px;
    }
    .loading span {
      width: 4px;
      height: 50px;
      background: #4c86f9;
      animation: scale 0.9s ease-in-out infinite;
    }
    .loading span:nth-child(2) {
      background: #49a84c;
      animation-delay: -0.8s;
    }
    .loading span:nth-child(3) {
      background: #f6bb01;
      animation-delay: -0.7s;
    }
    .loading span:nth-child(4) {
      background: #f6bb02;
      animation-delay: -0.6s;
    }
    .loading span:nth-child(5) {
      background: #2196f3;
      animation-delay: -0.5s;
    }
    @keyframes scale {
      0%, 40%, 100% {
        transform: scaleY(0.05);
      }
      20% {
        transform: scaleY(1);
      }
    }
  `;
  document.head.appendChild(style);

  // 2. Inject HTML Structure
  const preloaderDiv = document.createElement('div');
  preloaderDiv.id = 'preloader';
  preloaderDiv.innerHTML = `
    <div class="loading">
      <span></span>
      <span></span>
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;

  function insertPreloader() {
    if (document.body) {
      document.body.insertBefore(preloaderDiv, document.body.firstChild);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertPreloader);
  } else {
    insertPreloader();
  }

  // 3. Remove on Page Load Complete with a 2-Second Delay
  window.addEventListener('load', function () {
    setTimeout(() => {
      const preloader = document.getElementById('preloader');
      if (preloader) {
        preloader.style.opacity = '0';
        setTimeout(() => {
          preloader.style.display = 'none';
        }, 400); // Matches the 0.4s fade-out transition
      }
    }, 2000); // 2000 milliseconds = 2 seconds
  });
})();