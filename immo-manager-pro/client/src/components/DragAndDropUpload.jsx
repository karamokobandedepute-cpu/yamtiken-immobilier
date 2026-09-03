import React, { useState, useRef } from 'react';
import { Upload, X, File, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DragAndDropUpload({ onFileAccept, acceptedTypes = "image/*,application/pdf", maxFiles = 5 }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (newFiles) => {
    // Append new files up to the maximum limit
    const validFiles = newFiles.filter(file => {
      // Basic type validation based on acceptedTypes string (simplified)
      if (acceptedTypes.includes('*')) return true; // Very simple check for demo
      return acceptedTypes.includes(file.type);
    });
    
    const updatedFiles = [...files, ...validFiles].slice(0, maxFiles);
    setFiles(updatedFiles);
    
    if (onFileAccept) {
      onFileAccept(updatedFiles);
    }
  };

  const removeFile = (indexToRemove) => {
    const updatedFiles = files.filter((_, index) => index !== indexToRemove);
    setFiles(updatedFiles);
    if (onFileAccept) {
      onFileAccept(updatedFiles);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes}
        onChange={handleChange}
        className="hidden"
      />
      
      <motion.div
        className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-200 ease-in-out ${
          isDragActive 
            ? 'border-midGreen bg-paleGreen dark:bg-midGreen/20' 
            : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={onButtonClick}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-green-100 dark:bg-green-900/50">
          <Upload className="w-6 h-6 text-midGreen dark:text-lightGreen" />
        </div>
        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
          <span className="font-semibold">Cliquez pour ajouter</span> ou glissez-déposez
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          SVG, PNG, JPG, PDF (Max. {maxFiles} fichiers)
        </p>
      </motion.div>

      {/* Liste des fichiers uploadés */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.ul 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-2"
          >
            {files.map((file, index) => (
              <motion.li
                key={`${file.name}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {file.type.includes('image') ? (
                    <ImageIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  ) : (
                    <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                    {file.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
