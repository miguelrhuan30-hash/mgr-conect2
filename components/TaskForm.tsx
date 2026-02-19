import React, { useState } from 'react';
import firebase from '../firebase';
import { db } from '../firebase';
import { CollectionName } from '../types';
import { PlusCircle, Loader2 } from 'lucide-react';

const TaskForm: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      // Direct Firestore Operation - No local state management for the data itself
      await db.collection(CollectionName.TASKS).add({
        title: title.trim(),
        description: description.trim(),
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp() // Server-side timestamp for accuracy
      });

      // Reset form only
      setTitle('');
      setDescription('');
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("Failed to save to cloud. Check console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all hover:shadow-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Task Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="block w-full rounded-lg border-gray-300 bg-white border p-2.5 text-gray-900 focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition-colors"
            required
          />
        </div>
        
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <textarea
            id="description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details about this task..."
            className="block w-full rounded-lg border-gray-300 bg-white border p-2.5 text-gray-900 focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition-colors resize-none"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
              isSubmitting ? 'pl-3' : ''
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                Saving...
              </>
            ) : (
              <>
                <PlusCircle className="-ml-1 mr-2 h-4 w-4" />
                Add Task
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskForm;